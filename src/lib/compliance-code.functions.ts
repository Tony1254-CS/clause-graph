import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Stack = "aws" | "gcp" | "azure";
export type CodeArtifact = {
  language: "python" | "bash" | "terraform" | "yaml";
  code: string;
  description: string;
};

export type ComplianceCode = {
  gap: string;
  stack: Stack;
  audit_script: CodeArtifact;
  remediation: CodeArtifact;
  test_cases: string[];
  runbook: string;
  fallback: boolean;
};

type Input = {
  regulationText: string;
  gap: string;
  stack?: Stack;
  regulationId?: string;
  simulationRunId?: string;
};

function fallbackArtifact(gap: string, stack: Stack): ComplianceCode {
  const python = `#!/usr/bin/env python3
"""Audit: ${gap.replace(/"/g, "'")}"""
import boto3, json, sys

def audit():
    client = boto3.client("s3")
    findings = []
    for bucket in client.list_buckets().get("Buckets", []):
        name = bucket["Name"]
        try:
            enc = client.get_bucket_encryption(Bucket=name)
            rules = enc["ServerSideEncryptionConfiguration"]["Rules"]
            algo = rules[0]["ApplyServerSideEncryptionByDefault"]["SSEAlgorithm"]
            if algo not in ("AES256", "aws:kms"):
                findings.append({"bucket": name, "issue": f"weak-algo:{algo}"})
        except client.exceptions.ClientError:
            findings.append({"bucket": name, "issue": "no-encryption-config"})
    print(json.dumps({"gap": ${JSON.stringify(gap)}, "findings": findings}, indent=2))
    sys.exit(1 if findings else 0)

if __name__ == "__main__":
    audit()
`;

  const terraform = `# Remediation: enforce encryption at rest for every S3 bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "enforce_aes" {
  for_each = toset(var.bucket_names)
  bucket   = each.value

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_policy" "deny_unencrypted_uploads" {
  for_each = toset(var.bucket_names)
  bucket   = each.value

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyUnencryptedUploads"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:PutObject"
      Resource  = "arn:aws:s3:::\${each.value}/*"
      Condition = {
        StringNotEquals = { "s3:x-amz-server-side-encryption" = "AES256" }
      }
    }]
  })
}

variable "bucket_names" { type = list(string) }
`;

  return {
    gap,
    stack,
    audit_script: { language: "python", code: python, description: "Boto3 audit that lists every bucket and flags any without AES256/KMS encryption." },
    remediation: { language: "terraform", code: terraform, description: "Terraform module that enforces AES256 encryption and denies unencrypted uploads on every bucket." },
    test_cases: [
      "Bucket without any encryption configuration → flagged",
      "Bucket with AES256 → passes",
      "Bucket with aws:kms → passes",
      "Bucket with legacy SSE-C only → flagged as weak-algo",
    ],
    runbook: `## Runbook — ${gap}\n\n1. Run the audit script from a role with s3:ListAllMyBuckets and s3:GetEncryptionConfiguration.\n2. For every finding, apply the Terraform remediation with the bucket name.\n3. Re-run the audit; exit code 0 confirms compliance.`,
    fallback: true,
  };
}

function coerce(raw: unknown, gap: string, stack: Stack): ComplianceCode | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const parseArt = (v: unknown, fallback: CodeArtifact["language"]): CodeArtifact | null => {
    if (!v || typeof v !== "object") return null;
    const x = v as Record<string, unknown>;
    const code = String(x.code ?? "");
    if (!code) return null;
    const langRaw = String(x.language ?? fallback).toLowerCase();
    const language = (["python", "bash", "terraform", "yaml"] as const).find((l) => l === langRaw) ?? fallback;
    return { language, code, description: String(x.description ?? "") };
  };
  const audit = parseArt(o.audit_script ?? o.audit, "python");
  const remediation = parseArt(o.remediation ?? o.fix, "terraform");
  if (!audit || !remediation) return null;
  const tests = Array.isArray(o.test_cases) ? o.test_cases.map(String).filter(Boolean).slice(0, 8) : [];
  const runbook = typeof o.runbook === "string" ? o.runbook : "";
  return { gap, stack, audit_script: audit, remediation, test_cases: tests, runbook, fallback: false };
}

export const generateComplianceCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => {
    const regulationText = String(input?.regulationText ?? "").trim();
    const gap = String(input?.gap ?? "").trim();
    if (!regulationText) throw new Error("Regulation text required");
    if (!gap) throw new Error("Compliance gap description required");
    const stack: Stack = input?.stack === "gcp" || input?.stack === "azure" ? input.stack : "aws";
    return {
      regulationText: regulationText.slice(0, 12000),
      gap: gap.slice(0, 2000),
      stack,
      regulationId: input?.regulationId ? String(input.regulationId) : undefined,
      simulationRunId: input?.simulationRunId ? String(input.simulationRunId) : undefined,
    };
  })
  .handler(async ({ data, context }): Promise<ComplianceCode> => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;

    let result: ComplianceCode | null = null;

    if (apiKey) {
      try {
        const system = `You are a compliance engineer. Given a regulation requirement and a described compliance gap in a typical ${data.stack.toUpperCase()} environment, produce (a) an executable audit script that checks for the gap and (b) an infrastructure-as-code remediation snippet that fixes it.
Return STRICT JSON, no code fences:
{"audit_script": {"language": "python"|"bash", "code": string, "description": string},
 "remediation": {"language": "terraform"|"yaml"|"bash", "code": string, "description": string},
 "test_cases": [string],
 "runbook": string}
Rules:
- code MUST be syntactically valid and sandbox-safe (read-only for audit; explicit inputs for remediation).
- Prefer boto3 for AWS Python audits, gcloud for GCP, az CLI for Azure.
- Prefer Terraform for AWS remediation, YAML/kubectl for k8s scenarios.
- Keep each code block under 3500 characters.`;
        const user = `REGULATION:
${data.regulationText}

COMPLIANCE GAP:
${data.gap}

TARGET STACK: ${data.stack.toUpperCase()}`;

        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 45_000);
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
          body: JSON.stringify({
            model: "google/gemini-3.6-flash",
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
          }),
        }).finally(() => clearTimeout(t));

        if (res.ok) {
          const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const content = j.choices?.[0]?.message?.content ?? "";
          try {
            result = coerce(JSON.parse(content), data.gap, data.stack);
          } catch {
            /* fallback */
          }
        } else {
          console.error("[compliance-code] gateway", res.status, await res.text().catch(() => ""));
        }
      } catch (err) {
        console.error("[compliance-code] exception", err);
      }
    }

    const finalResult = result ?? fallbackArtifact(data.gap, data.stack);

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.org_id) {
      const { error } = await supabase.from("compliance_artifacts").insert({
        org_id: profile.org_id,
        regulation_id: data.regulationId ?? null,
        simulation_run_id: data.simulationRunId ?? null,
        gap: finalResult.gap,
        stack: finalResult.stack,
        audit_script: JSON.parse(JSON.stringify(finalResult.audit_script)),
        remediation: JSON.parse(JSON.stringify(finalResult.remediation)),
        runbook: finalResult.runbook,
        test_cases: finalResult.test_cases,
        created_by: userId,
      });
      if (error) console.error("[compliance-code] persist error", error);
    }

    return finalResult;
  });
