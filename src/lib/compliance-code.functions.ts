import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";

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
  .middleware([requireAuth])
  .validator((input: Input) => {
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
    const { userId, orgId } = context;
    const { query } = await import("./db.server");
    const { coerceComplianceCode, fallbackArtifact } = await import("./compliance-code.server");
    const { chatCompletion } = await import("./ai.server");

    // Server-side entitlement gate: compliance-as-code
    if (orgId) {
      try {
        await query(`SELECT assert_within_quota($1, 'generate_compliance_code')`, [orgId]);
      } catch (quotaErr) {
        throw new Error(quotaErr instanceof Error ? quotaErr.message : "Quota exceeded");
      }
    }

    let result: ComplianceCode | null = null;

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

      const content = await chatCompletion({
        model: "gpt-4o",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      if (content) {
        try {
          result = coerceComplianceCode(JSON.parse(content), data.gap, data.stack);
        } catch {
          /* fallback */
        }
      }
    } catch (err) {
      console.error("[compliance-code] exception", err);
    }

    const finalResult = result ?? fallbackArtifact(data.gap, data.stack);

    if (orgId) {
      try {
        await query(
          `INSERT INTO public.compliance_artifacts 
           (org_id, regulation_id, simulation_run_id, gap, stack, audit_script, remediation, runbook, test_cases, created_by)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)`,
          [
            orgId,
            data.regulationId ?? null,
            data.simulationRunId ?? null,
            finalResult.gap,
            finalResult.stack,
            JSON.stringify(finalResult.audit_script),
            JSON.stringify(finalResult.remediation),
            finalResult.runbook,
            finalResult.test_cases,
            userId,
          ]
        );
      } catch (insertErr) {
        console.error("[compliance-code] persist error", insertErr);
      }
    }

    return finalResult;
  });
