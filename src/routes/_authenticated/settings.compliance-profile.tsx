import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShieldCheck,
  Building2,
  Globe2,
  CheckCircle2,
  Save,
  Scale,
  CreditCard,
  HeartPulse,
  Users,
  Cpu,
  Server,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { RouteError } from "@/components/clausegraph/RouteError";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { complianceProfileQuery } from "@/data/queries";
import {
  saveComplianceProfileFn,
  deduceApplicableFrameworks,
  type SaveComplianceProfileInput,
} from "@/lib/compliance-profile.functions";

export const Route = createFileRoute("/_authenticated/settings/compliance-profile")({
  head: () => ({
    meta: [
      { title: "Compliance Profile — ClauseGraph" },
      { name: "description", content: "Configure enterprise legal jurisdiction, data footprint, and active regulatory ontology." },
    ],
  }),
  component: ComplianceProfilePage,
  errorComponent: ({ error, reset }) => (
    <RouteError title="Compliance Profile unavailable" error={error} reset={reset} />
  ),
});

const COUNTRIES = [
  { code: "BD", name: "Bangladesh 🇧🇩" },
  { code: "US", name: "United States 🇺🇸" },
  { code: "DE", name: "Germany (EU) 🇩🇪" },
  { code: "FR", name: "France (EU) 🇫🇷" },
  { code: "NL", name: "Netherlands (EU) 🇳🇱" },
  { code: "IE", name: "Ireland (EU) 🇮🇪" },
  { code: "GB", name: "United Kingdom 🇬🇧" },
  { code: "SG", name: "Singapore 🇸🇬" },
];

const INDUSTRIES = [
  { id: "saas", name: "B2B SaaS & Cloud Software" },
  { id: "fintech", name: "FinTech & Digital Payments" },
  { id: "healthcare", name: "HealthTech & Life Sciences" },
  { id: "ai", name: "AI & Machine Learning Provider" },
  { id: "ecommerce", name: "E-Commerce & Consumer Retail" },
  { id: "manufacturing", name: "Manufacturing & Export" },
];

const FRAMEWORK_DESCRIPTIONS: Record<string, { title: string; citation: string; jurisdiction: string }> = {
  "REG-BD-CSO-2025": {
    title: "Cyber Security Ordinance 2025",
    citation: "Ordinance No. 25 of 2025",
    jurisdiction: "Bangladesh",
  },
  "REG-BD-LA-2006": {
    title: "Labour Act 2006 (§26 Notice & Dues)",
    citation: "Act No. 42 of 2006",
    jurisdiction: "Bangladesh",
  },
  "REG-BB-DPS-2023": {
    title: "Digital Payment Security Guidelines",
    citation: "PSD Circular (2FA/Tokenisation)",
    jurisdiction: "Bangladesh Bank",
  },
  "REG-GDPR-5": {
    title: "GDPR Article 5 (Principles / Minimization)",
    citation: "Regulation (EU) 2016/679",
    jurisdiction: "European Union",
  },
  "REG-GDPR-33": {
    title: "GDPR Article 33 (72h Breach Notification)",
    citation: "Regulation (EU) 2016/679",
    jurisdiction: "European Union",
  },
  "REG-GDPR-44": {
    title: "GDPR Article 44 (Cross-Border Transfers)",
    citation: "Regulation (EU) 2016/679",
    jurisdiction: "European Union",
  },
  "REG-EU-AIACT-2024": {
    title: "EU Artificial Intelligence Act 2024",
    citation: "Regulation (EU) 2024/1689",
    jurisdiction: "European Union",
  },
  "REG-EU-DIGITAL-OMNIBUS-2026": {
    title: "Digital Omnibus on AI 2026",
    citation: "Regulation (EU) 2026/1744",
    jurisdiction: "European Union",
  },
  "REG-HIPAA-SEC": {
    title: "HIPAA Security Rule (Technical Safeguards)",
    citation: "45 CFR §164.312",
    jurisdiction: "United States",
  },
  "REG-CCPA-1798.120": {
    title: "CCPA / CPRA Consumer Privacy",
    citation: "Cal. Civ. Code §1798.120",
    jurisdiction: "California, US",
  },
  "REG-SEC-17A4": {
    title: "SEC Rule 17a-4 (Electronic Records)",
    citation: "17 CFR §240.17a-4",
    jurisdiction: "US SEC",
  },
  "REG-SOX-302": {
    title: "Sarbanes-Oxley Internal Controls (§302/§404)",
    citation: "15 U.S.C. §7262",
    jurisdiction: "US Federal",
  },
};

function ComplianceProfilePage() {
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery(complianceProfileQuery);

  const [entityName, setEntityName] = useState("");
  const [hqCountry, setHqCountry] = useState("BD");
  const [isPublic, setIsPublic] = useState(false);
  const [industry, setIndustry] = useState("saas");

  const [processesEu, setProcessesEu] = useState(false);
  const [processesHealth, setProcessesHealth] = useState(false);
  const [processesUsConsumer, setProcessesUsConsumer] = useState(false);
  const [processesPayments, setProcessesPayments] = useState(false);
  const [developsAi, setDevelopsAi] = useState(false);
  const [cloudProviders, setCloudProviders] = useState<string[]>(["aws"]);

  useEffect(() => {
    if (profile) {
      setEntityName(profile.entity_name || "");
      setHqCountry(profile.headquarters_country || "BD");
      setIsPublic(profile.is_publicly_traded || false);
      setIndustry(profile.industry_vertical || "saas");
      setProcessesEu(profile.processes_eu_data || false);
      setProcessesHealth(profile.processes_us_health_data || false);
      setProcessesUsConsumer(profile.processes_us_consumer_data || false);
      setProcessesPayments(profile.processes_digital_payments || false);
      setDevelopsAi(profile.develops_or_uses_ai || false);
      setCloudProviders(profile.cloud_providers?.length ? profile.cloud_providers : ["aws"]);
    }
  }, [profile]);

  const deducedFrameworkIds = useMemo(() => {
    return deduceApplicableFrameworks({
      headquarters_country: hqCountry,
      is_publicly_traded: isPublic,
      industry_vertical: industry,
      processes_eu_data: processesEu,
      processes_us_health_data: processesHealth,
      processes_us_consumer_data: processesUsConsumer,
      processes_digital_payments: processesPayments,
      develops_or_uses_ai: developsAi,
    });
  }, [hqCountry, isPublic, industry, processesEu, processesHealth, processesUsConsumer, processesPayments, developsAi]);

  const saveMutation = useMutation({
    mutationFn: async (payload: SaveComplianceProfileInput) => {
      return await saveComplianceProfileFn({ data: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance-profile"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Compliance profile updated successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update compliance profile");
    },
  });

  const handleSave = () => {
    if (!entityName.trim()) {
      toast.error("Entity name is required");
      return;
    }
    saveMutation.mutate({
      entity_name: entityName.trim(),
      headquarters_country: hqCountry,
      is_publicly_traded: isPublic,
      industry_vertical: industry,
      processes_eu_data: processesEu,
      processes_us_health_data: processesHealth,
      processes_us_consumer_data: processesUsConsumer,
      processes_digital_payments: processesPayments,
      develops_or_uses_ai: developsAi,
      cloud_providers: cloudProviders,
    });
  };

  const toggleCloud = (provider: string) => {
    setCloudProviders((prev) =>
      prev.includes(provider)
        ? prev.length > 1
          ? prev.filter((p) => p !== provider)
          : prev
        : [...prev, provider]
    );
  };

  return (
    <AppShell>
      <div className="space-y-8 max-w-5xl">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--hairline)] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--brass)]">
                Organization Settings
              </span>
              {profile?.is_onboarded && (
                <Badge className="bg-[var(--brass)]/15 text-[var(--brass)] border-[var(--brass)]/30 font-mono text-[9px]">
                  ONBOARDED · ACTIVE SCOPE
                </Badge>
              )}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Compliance Scope & Statutory Profile
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Manage your entity jurisdiction, data footprints, and the active regulatory frameworks governing your contracts.
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || isLoading}
            className="gap-2 bg-[var(--brass)] text-black hover:bg-[var(--brass)]/90 font-semibold shadow-[var(--glow-brass)] shrink-0"
          >
            {saveMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Configuration Form */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Entity & Incorporation */}
            <div className="glass-panel p-6 space-y-5 rounded-2xl border border-[var(--hairline)]">
              <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[var(--brass)]" /> Entity & Domicile
              </h2>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Legal Entity Name</label>
                <input
                  type="text"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  placeholder="e.g. Apex FinTech Ltd."
                  className="search-input-theme w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--brass)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Primary Incorporation (HQ)</label>
                  <select
                    value={hqCountry}
                    onChange={(e) => setHqCountry(e.target.value)}
                    className="search-input-theme w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--brass)]"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-background text-foreground">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Industry Sector</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="search-input-theme w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--brass)]"
                  >
                    {INDUSTRIES.map((ind) => (
                      <option key={ind.id} value={ind.id} className="bg-background text-foreground">
                        {ind.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-[var(--brass)]" />
                    <span className="text-xs font-semibold text-foreground">Publicly Traded / Listed Entity</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Enforces Sarbanes-Oxley (SOX §302/§404) internal audit controls and officer certifications.
                  </p>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
            </div>

            {/* 2. Operational Footprint & Data Subjects */}
            <div className="glass-panel p-6 space-y-4 rounded-2xl border border-[var(--hairline)]">
              <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-[var(--brass)]" /> Data Operations & Statutory Triggers
              </h2>
              <p className="text-xs text-muted-foreground">
                Toggling these switches dynamically activates statutory frameworks and reconfigures contract extraction checks:
              </p>

              <div className="space-y-3">
                {/* EU GDPR */}
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">Process European (EU/EEA) Residents' Data</span>
                      <Badge variant="outline" className="text-[9px] font-mono border-sky-500/30 text-sky-400">EU GDPR</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Triggers Article 5 Data Minimization, Article 33 72-hour breach notices, and Article 44 transfer safeguards.
                    </p>
                  </div>
                  <Switch checked={processesEu} onCheckedChange={setProcessesEu} />
                </div>

                {/* Digital Payments */}
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">Process Digital Payments & Transactions</span>
                      <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/30 text-emerald-400">BB DPS 2023</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Mandates 2FA above BDT 5,000, card tokenization, and 6-hour incident disclosure.
                    </p>
                  </div>
                  <Switch checked={processesPayments} onCheckedChange={setProcessesPayments} />
                </div>

                {/* HIPAA */}
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">Handle US Protected Health Information (ePHI)</span>
                      <Badge variant="outline" className="text-[9px] font-mono border-rose-500/30 text-rose-400">HIPAA</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Enforces Business Associate Agreement (BAA) safeguards and 45 CFR §164 encryption audits.
                    </p>
                  </div>
                  <Switch checked={processesHealth} onCheckedChange={setProcessesHealth} />
                </div>

                {/* CCPA */}
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">Serve California / US Retail Consumers</span>
                      <Badge variant="outline" className="text-[9px] font-mono border-amber-500/30 text-amber-400">CCPA/CPRA</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Mandates opt-out sale disclosure, Global Privacy Control signals, and consumer data rights.
                    </p>
                  </div>
                  <Switch checked={processesUsConsumer} onCheckedChange={setProcessesUsConsumer} />
                </div>

                {/* EU AI Act */}
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">Develop, Train, or Deploy AI / LLMs</span>
                      <Badge variant="outline" className="text-[9px] font-mono border-purple-500/30 text-purple-400">EU AI Act</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Enforces High-Risk classification, model evaluation benchmarks, and training transparency.
                    </p>
                  </div>
                  <Switch checked={developsAi} onCheckedChange={setDevelopsAi} />
                </div>
              </div>

              {/* Cloud stack */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-medium text-foreground">
                  Active Cloud Infrastructure Providers
                </label>
                <div className="flex flex-wrap gap-2">
                  {["aws", "gcp", "azure", "onprem"].map((provider) => {
                    const active = cloudProviders.includes(provider);
                    return (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => toggleCloud(provider)}
                        className={`rounded-lg border px-3.5 py-1.5 text-xs font-mono font-medium transition-all ${
                          active
                            ? "border-[var(--brass)] bg-[var(--brass)]/15 text-[var(--brass)]"
                            : "border-[var(--hairline)] bg-[var(--surface-raised)]/40 text-muted-foreground hover:border-[var(--brass)]/40"
                        }`}
                      >
                        {provider.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Active Frameworks & Live Scope Preview */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel p-6 space-y-5 rounded-2xl border border-[var(--brass)]/30 bg-[var(--surface-raised)]/80">
              <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brass)] text-black">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-foreground">
                      Active Legal Frameworks
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {deducedFrameworkIds.length} statutes currently in-scope
                    </p>
                  </div>
                </div>
                <Badge className="bg-[var(--brass)] text-black font-mono text-[10px]">
                  LIVE MAPPING
                </Badge>
              </div>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {deducedFrameworkIds.map((id) => {
                  const meta = FRAMEWORK_DESCRIPTIONS[id] || {
                    title: id,
                    citation: "Statutory Instrument",
                    jurisdiction: "International",
                  };
                  return (
                    <div
                      key={id}
                      className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-glass)] p-3.5 space-y-1 transition-all hover:border-[var(--brass)]/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--brass)] shrink-0" />
                          <span className="text-xs font-semibold text-foreground">
                            {meta.title}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10.5px] font-mono text-muted-foreground pl-5">
                        {meta.citation} · {meta.jurisdiction}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-glass-strong)] p-3.5 text-xs text-muted-foreground leading-relaxed">
                💡 <span className="font-medium text-foreground">Auto-wiring logic:</span> When you save changes, contract clause extraction, Federal Register alerts, and blast radius simulations will automatically prioritize these frameworks.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
