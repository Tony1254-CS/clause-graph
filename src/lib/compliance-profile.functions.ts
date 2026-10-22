import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";

export type ComplianceProfile = {
  org_id: string;
  entity_name: string;
  headquarters_country: string;
  is_publicly_traded: boolean;
  industry_vertical: string;
  processes_eu_data: boolean;
  processes_us_health_data: boolean;
  processes_us_consumer_data: boolean;
  processes_digital_payments: boolean;
  develops_or_uses_ai: boolean;
  cloud_providers: string[];
  active_framework_ids: string[];
  is_onboarded: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SaveComplianceProfileInput = {
  entity_name: string;
  headquarters_country: string;
  is_publicly_traded: boolean;
  industry_vertical: string;
  processes_eu_data: boolean;
  processes_us_health_data: boolean;
  processes_us_consumer_data: boolean;
  processes_digital_payments: boolean;
  develops_or_uses_ai: boolean;
  cloud_providers: string[];
};

/**
 * Deterministically computes active statutory frameworks based on organization profile
 */
export function deduceApplicableFrameworks(profile: Partial<SaveComplianceProfileInput>): string[] {
  const frameworks = new Set<string>();

  const hq = (profile.headquarters_country || "BD").toUpperCase();

  // Domestic laws based on HQ
  if (hq === "BD") {
    frameworks.add("REG-BD-CSO-2025");
    frameworks.add("REG-BD-LA-2006");
  } else if (hq === "US") {
    frameworks.add("REG-SEC-17A4");
  } else if (["DE", "FR", "NL", "IE", "ES", "IT", "BE", "SE", "PL", "EU"].includes(hq)) {
    frameworks.add("REG-GDPR-5");
    frameworks.add("REG-GDPR-33");
    frameworks.add("REG-GDPR-44");
  }

  // Cross-border and operational triggers
  if (profile.processes_eu_data) {
    frameworks.add("REG-GDPR-5");
    frameworks.add("REG-GDPR-33");
    frameworks.add("REG-GDPR-44");
  }

  if (profile.processes_us_health_data) {
    frameworks.add("REG-HIPAA-SEC");
  }

  if (profile.processes_us_consumer_data) {
    frameworks.add("REG-CCPA-1798.120");
  }

  if (profile.processes_digital_payments) {
    frameworks.add("REG-BB-DPS-2023");
  }

  if (profile.develops_or_uses_ai) {
    frameworks.add("REG-EU-AIACT-2024");
    frameworks.add("REG-EU-DIGITAL-OMNIBUS-2026");
  }

  if (profile.is_publicly_traded) {
    frameworks.add("REG-SOX-302");
    frameworks.add("REG-SEC-17A4");
  }

  // Industry-specific fallbacks
  if (profile.industry_vertical === "fintech") {
    frameworks.add("REG-BB-DPS-2023");
  } else if (profile.industry_vertical === "healthcare") {
    frameworks.add("REG-HIPAA-SEC");
  }

  // If set is empty, provide baseline domestic anchor
  if (frameworks.size === 0) {
    frameworks.add("REG-BD-CSO-2025");
  }

  return Array.from(frameworks);
}

export const getComplianceProfileFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<ComplianceProfile> => {
    const { orgId } = context;
    if (!orgId) throw new Error("Organization not found");

    const { queryOne, query } = await import("./db.server");

    let profile = await queryOne<ComplianceProfile>(
      `SELECT * FROM public.organization_compliance_profiles WHERE org_id = $1`,
      [orgId]
    );

    if (!profile) {
      // Lazy initialize profile if missing
      const org = await queryOne<{ name: string }>(
        `SELECT name FROM public.organizations WHERE id = $1`,
        [orgId]
      );
      const entityName = org?.name || "My Organization";
      const defaultFrameworks = ["REG-BD-CSO-2025", "REG-BB-DPS-2023", "REG-GDPR-5"];

      const inserted = await queryOne<ComplianceProfile>(
        `INSERT INTO public.organization_compliance_profiles 
          (org_id, entity_name, is_onboarded, active_framework_ids)
         VALUES ($1, $2, false, $3)
         RETURNING *`,
        [orgId, entityName, defaultFrameworks]
      );
      profile = inserted!;
    }

    return profile;
  });

export const saveComplianceProfileFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: SaveComplianceProfileInput) => {
    const entity_name = String(input?.entity_name ?? "").trim();
    if (!entity_name) throw new Error("Entity name is required");

    return {
      entity_name,
      headquarters_country: String(input?.headquarters_country ?? "BD").trim().toUpperCase(),
      is_publicly_traded: Boolean(input?.is_publicly_traded),
      industry_vertical: String(input?.industry_vertical ?? "saas").trim().toLowerCase(),
      processes_eu_data: Boolean(input?.processes_eu_data),
      processes_us_health_data: Boolean(input?.processes_us_health_data),
      processes_us_consumer_data: Boolean(input?.processes_us_consumer_data),
      processes_digital_payments: Boolean(input?.processes_digital_payments),
      develops_or_uses_ai: Boolean(input?.develops_or_uses_ai),
      cloud_providers: Array.isArray(input?.cloud_providers) && input.cloud_providers.length > 0
        ? input.cloud_providers
        : ["aws"],
    };
  })
  .handler(async ({ data, context }): Promise<ComplianceProfile> => {
    const { orgId } = context;
    if (!orgId) throw new Error("Organization not found");

    const { queryOne, query } = await import("./db.server");

    // Deduce relevant active framework IDs
    const activeFrameworks = deduceApplicableFrameworks(data);

    // Save and mark is_onboarded = true
    const updated = await queryOne<ComplianceProfile>(
      `INSERT INTO public.organization_compliance_profiles (
        org_id, entity_name, headquarters_country, is_publicly_traded, industry_vertical,
        processes_eu_data, processes_us_health_data, processes_us_consumer_data,
        processes_digital_payments, develops_or_uses_ai, cloud_providers,
        active_framework_ids, is_onboarded, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, now()
      )
      ON CONFLICT (org_id) DO UPDATE SET
        entity_name = EXCLUDED.entity_name,
        headquarters_country = EXCLUDED.headquarters_country,
        is_publicly_traded = EXCLUDED.is_publicly_traded,
        industry_vertical = EXCLUDED.industry_vertical,
        processes_eu_data = EXCLUDED.processes_eu_data,
        processes_us_health_data = EXCLUDED.processes_us_health_data,
        processes_us_consumer_data = EXCLUDED.processes_us_consumer_data,
        processes_digital_payments = EXCLUDED.processes_digital_payments,
        develops_or_uses_ai = EXCLUDED.develops_or_uses_ai,
        cloud_providers = EXCLUDED.cloud_providers,
        active_framework_ids = EXCLUDED.active_framework_ids,
        is_onboarded = true,
        updated_at = now()
      RETURNING *`,
      [
        orgId,
        data.entity_name,
        data.headquarters_country,
        data.is_publicly_traded,
        data.industry_vertical,
        data.processes_eu_data,
        data.processes_us_health_data,
        data.processes_us_consumer_data,
        data.processes_digital_payments,
        data.develops_or_uses_ai,
        data.cloud_providers,
        activeFrameworks,
      ]
    );

    // Also sync the organization name in public.organizations
    await query(
      `UPDATE public.organizations SET name = $1 WHERE id = $2`,
      [data.entity_name, orgId]
    );

    return updated!;
  });
