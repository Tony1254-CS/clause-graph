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
  artifact_id?: string;
  review_status?: "pending_review" | "approved" | "rejected";
  review_id?: string;
  flag_reasons?: string[];
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
    const { evaluateGate, enqueueForReview } = await import("./review/gate.server");
    const engine = finalResult.fallback ? "deterministic_fallback" : "llm";
    const artifactUuid = `00000000-0000-0000-0000-${Date.now().toString(16).padStart(12, "0")}`.slice(0, 36);

    let createdId = artifactUuid;
    if (orgId) {
      try {
        const row = await queryOne<{ id: string }>(
          `INSERT INTO public.compliance_artifacts 
           (org_id, regulation_id, simulation_run_id, gap, stack, audit_script, remediation, runbook, test_cases, created_by)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
           RETURNING id`,
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
        if (row?.id) createdId = row.id;
      } catch (insertErr) {
        console.error("[compliance-code] persist error", insertErr);
      }
    }

    finalResult.artifact_id = createdId;

    // Non-configurable floor: Compliance-as-Code is ALWAYS gated (§4.2)
    const gate = evaluateGate({
      sourceType: "compliance_artifact",
      severity: "high",
      engine,
      inputText: data.regulationText,
    });

    try {
      const review = await enqueueForReview({
        orgId,
        sourceType: "compliance_artifact",
        sourceId: createdId,
        severity: "high",
        summary: `Compliance-as-Code remediation for ${finalResult.gap.slice(0, 100)}`,
        payload: {
          audit_script: finalResult.audit_script,
          remediation: finalResult.remediation,
          test_cases: finalResult.test_cases,
          runbook: finalResult.runbook,
        },
        inputSnapshot: {
          regulationText: data.regulationText,
          gap: data.gap,
          stack: data.stack,
        },
        engine,
        modelName: "gpt-4o",
        promptVersion: "v2.0",
        gate,
        submittedBy: userId,
      });

      finalResult.review_status = "pending_review";
      finalResult.review_id = review.id;
      finalResult.flag_reasons = gate.flagReasons;
    } catch (enqueueErr) {
      console.warn("[compliance-code] enqueue error:", enqueueErr);
      finalResult.review_status = "pending_review";
    }

    // Record code.generated audit event (§5)
    if (orgId) {
      try {
        const { logAuditEvent } = await import("./audit/audit.server");
        await logAuditEvent({
          orgId,
          action: "code.generated",
          entityType: "compliance_artifact",
          entityId: createdId,
          actorId: userId,
          actorRole: (context.role as any) || "member",
          after: {
            stack: data.stack,
            gap: data.gap,
            has_audit_script: Boolean(finalResult.audit_script?.code),
            has_remediation: Boolean(finalResult.remediation?.code),
          },
          basis: {
            engine,
            model_name: "gpt-4o",
            prompt_version: "v2.0",
          },
        });
      } catch (auditErr) {
        console.warn("[compliance-code] audit log error:", auditErr);
      }
    }

    return finalResult;
  });

/**
 * Server-side gate check for copying or downloading generated compliance code (§9)
 * Fails closed: refuses to emit code text if unapproved or modified
 */
export const requestVerifiedCode = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { artifactId: string; payload: any }) => {
    if (!input?.artifactId) throw new Error("Artifact ID required");
    return { artifactId: input.artifactId, payload: input.payload };
  })
  .handler(async ({ data, context }) => {
    const { requireApproved, ReviewGateError } = await import("./review/gate.server");
    try {
      await requireApproved("compliance_artifact", data.artifactId, data.payload);

      // Log artifact.exported audit event
      if (context.orgId) {
        try {
          const { logAuditEvent } = await import("./audit/audit.server");
          await logAuditEvent({
            orgId: context.orgId,
            action: "artifact.exported",
            entityType: "compliance_artifact",
            entityId: data.artifactId,
            actorId: context.userId,
            actorRole: (context.role as any) || "member",
          });
        } catch (auditErr) {
          console.warn("[compliance-code] artifact.exported audit error:", auditErr);
        }
      }

      return { approved: true, allowed: true };
    } catch (err) {
      if (err instanceof ReviewGateError) {
        return { approved: false, allowed: false, message: err.message };
      }
      return {
        approved: false,
        allowed: false,
        message: "Enforcement Gate: Human approval is strictly required before copying or applying Compliance-as-Code.",
      };
    }
  });
