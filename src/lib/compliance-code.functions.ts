import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { coerceComplianceCode, fallbackArtifact } from "./compliance-code.server";

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
            result = coerceComplianceCode(JSON.parse(content), data.gap, data.stack);
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
