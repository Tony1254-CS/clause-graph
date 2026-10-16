import type { CodeArtifact, ComplianceCode, Stack } from "./compliance-code.functions";

export function fallbackArtifact(gap: string, stack: Stack): ComplianceCode {
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
      Resource  = "arn:aws:s3:::${"${each.value}"}/*"
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
    audit_script: {
      language: "python",
      code: python,
      description:
        "Boto3 audit that lists every bucket and flags any without AES256/KMS encryption.",
    },
    remediation: {
      language: "terraform",
      code: terraform,
      description:
        "Terraform module that enforces AES256 encryption and denies unencrypted uploads on every bucket.",
    },
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

export function coerceComplianceCode(
  raw: unknown,
  gap: string,
  stack: Stack,
): ComplianceCode | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const parseArt = (v: unknown, fallback: CodeArtifact["language"]): CodeArtifact | null => {
    if (!v || typeof v !== "object") return null;
    const x = v as Record<string, unknown>;
    const code = String(x.code ?? "");
    if (!code) return null;
    const langRaw = String(x.language ?? fallback).toLowerCase();
    const language =
      (["python", "bash", "terraform", "yaml"] as const).find((l) => l === langRaw) ?? fallback;
    return { language, code, description: String(x.description ?? "") };
  };
  const audit = parseArt(o.audit_script ?? o.audit, "python");
  const remediation = parseArt(o.remediation ?? o.fix, "terraform");
  if (!audit || !remediation) return null;
  const tests = Array.isArray(o.test_cases)
    ? o.test_cases.map(String).filter(Boolean).slice(0, 8)
    : [];
  const runbook = typeof o.runbook === "string" ? o.runbook : "";
  return {
    gap,
    stack,
    audit_script: audit,
    remediation,
    test_cases: tests,
    runbook,
    fallback: false,
  };
}
