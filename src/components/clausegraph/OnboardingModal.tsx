import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  Globe2,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Server,
  Cpu,
  CreditCard,
  HeartPulse,
  Scale,
  Users,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  saveComplianceProfileFn,
  deduceApplicableFrameworks,
  type ComplianceProfile,
  type SaveComplianceProfileInput,
} from "@/lib/compliance-profile.functions";

interface OnboardingModalProps {
  open: boolean;
  profile?: ComplianceProfile | null;
  onComplete: () => void;
}

const COUNTRIES = [
  { code: "BD", name: "Bangladesh 🇧🇩", flag: "🇧🇩" },
  { code: "US", name: "United States 🇺🇸", flag: "🇺🇸" },
  { code: "DE", name: "Germany (EU) 🇩🇪", flag: "🇩🇪" },
  { code: "FR", name: "France (EU) 🇫🇷", flag: "🇫🇷" },
  { code: "NL", name: "Netherlands (EU) 🇳🇱", flag: "🇳🇱" },
  { code: "IE", name: "Ireland (EU) 🇮🇪", flag: "🇮🇪" },
  { code: "GB", name: "United Kingdom 🇬🇧", flag: "🇬🇧" },
  { code: "SG", name: "Singapore 🇸🇬", flag: "🇸🇬" },
];

const INDUSTRIES = [
  { id: "saas", name: "B2B SaaS & Cloud Software", icon: Server },
  { id: "fintech", name: "FinTech & Digital Payments", icon: CreditCard },
  { id: "healthcare", name: "HealthTech & Life Sciences", icon: HeartPulse },
  { id: "ai", name: "AI & Machine Learning Provider", icon: Cpu },
  { id: "ecommerce", name: "E-Commerce & Consumer Retail", icon: Users },
  { id: "manufacturing", name: "Manufacturing & Export", icon: Building2 },
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

export function OnboardingModal({ open, profile, onComplete }: OnboardingModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [entityName, setEntityName] = useState(profile?.entity_name || "");
  const [hqCountry, setHqCountry] = useState(profile?.headquarters_country || "BD");
  const [isPublic, setIsPublic] = useState(profile?.is_publicly_traded || false);
  const [industry, setIndustry] = useState(profile?.industry_vertical || "saas");

  // Operational triggers
  const [processesEu, setProcessesEu] = useState(profile?.processes_eu_data || false);
  const [processesHealth, setProcessesHealth] = useState(profile?.processes_us_health_data || false);
  const [processesUsConsumer, setProcessesUsConsumer] = useState(profile?.processes_us_consumer_data || false);
  const [processesPayments, setProcessesPayments] = useState(profile?.processes_digital_payments || false);
  const [developsAi, setDevelopsAi] = useState(profile?.develops_or_uses_ai || false);
  const [cloudProviders, setCloudProviders] = useState<string[]>(profile?.cloud_providers || ["aws"]);

  // Dynamically deduced frameworks
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
      queryClient.invalidateQueries({ queryKey: ["compliance-profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Workspace compliance profile configured successfully!");
      onComplete();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save profile");
    },
  });

  const handleFinish = () => {
    const payload: SaveComplianceProfileInput = {
      entity_name: entityName.trim() || "My Organization",
      headquarters_country: hqCountry,
      is_publicly_traded: isPublic,
      industry_vertical: industry,
      processes_eu_data: processesEu,
      processes_us_health_data: processesHealth,
      processes_us_consumer_data: processesUsConsumer,
      processes_digital_payments: processesPayments,
      develops_or_uses_ai: developsAi,
      cloud_providers: cloudProviders,
    };
    saveMutation.mutate(payload);
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
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onComplete()}>
      <DialogContent
        className="max-w-2xl overflow-hidden rounded-[24px] border border-[var(--hairline)] bg-[var(--shell-bg)] p-0 shadow-[var(--shadow-lift)] backdrop-blur-2xl sm:max-w-2xl"
      >
        {/* Ambient Top Glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[var(--brass)]/15 via-transparent to-transparent" />

        <div className="relative p-6 sm:p-8">
          {/* Header */}
          <DialogHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--brass)]/30 bg-[var(--brass)]/10 text-[var(--brass)] shadow-[var(--glow-brass)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--brass)]">
                    Enterprise Workspace Setup
                  </span>
                  <DialogTitle className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    Configure Compliance Profile
                  </DialogTitle>
                </div>
              </div>
              {/* Step indicator and Close X */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-muted-foreground">
                  <span className={`px-2 py-0.5 rounded-full ${step >= 1 ? "bg-[var(--brass)] text-black" : "bg-white/5"}`}>1</span>
                  <span className="text-[var(--hairline)]">/</span>
                  <span className={`px-2 py-0.5 rounded-full ${step >= 2 ? "bg-[var(--brass)] text-black" : "bg-white/5"}`}>2</span>
                  <span className="text-[var(--hairline)]">/</span>
                  <span className={`px-2 py-0.5 rounded-full ${step >= 3 ? "bg-[var(--brass)] text-black" : "bg-white/5"}`}>3</span>
                </div>
                <button
                  type="button"
                  onClick={onComplete}
                  className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close / Skip setup"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
              ClauseGraph tailors statutory ontology, contract extraction, and blast radius calculations to your business.
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Entity & Base Location */}
          {step === 1 && (
            <div className="mt-6 space-y-5 animate-in fade-in duration-300">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">
                  Legal Entity / Organization Name <span className="text-[var(--risk)]">*</span>
                </label>
                <input
                  type="text"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  placeholder="e.g. Acme FinTech Technologies Ltd."
                  className="search-input-theme w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--brass)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">
                    Headquarters / Incorporation
                  </label>
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
                  <label className="text-xs font-medium text-foreground">
                    Primary Industry Vertical
                  </label>
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

              {/* Publicly traded toggle */}
              <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-[var(--brass)]" />
                      <span className="text-xs font-semibold text-foreground">Publicly Traded / Exchange-Listed Entity</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Enable if your company is listed on stock exchanges (triggers Sarbanes-Oxley SOX §302/§404 internal control audits).
                    </p>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Industry & Data Footprint */}
          {step === 2 && (
            <div className="mt-6 space-y-4 animate-in fade-in duration-300">
              <p className="text-xs font-medium text-muted-foreground">
                Select your company's operational footprint and data processing activities:
              </p>

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {/* EU Residents Data */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Globe2 className="h-4 w-4 text-sky-400 shrink-0" />
                      <span className="text-xs font-semibold text-foreground">Process European (EU/EEA) Residents' Data</span>
                      <Badge variant="outline" className="text-[9px] font-mono border-sky-500/30 text-sky-400">
                        EU GDPR
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Applies if your services are accessible to European citizens, triggering 72h breach notices & transfer restrictions.
                    </p>
                  </div>
                  <Switch checked={processesEu} onCheckedChange={setProcessesEu} />
                </div>

                {/* Digital Payments */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-semibold text-foreground">Process Digital Payments & Transactions</span>
                      <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/30 text-emerald-400">
                        BB Payment Sec 2023
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Mandates 2FA, tokenisation, and continuous fraud detection under Bangladesh Bank guidelines.
                    </p>
                  </div>
                  <Switch checked={processesPayments} onCheckedChange={setProcessesPayments} />
                </div>

                {/* US Healthcare */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <HeartPulse className="h-4 w-4 text-rose-400 shrink-0" />
                      <span className="text-xs font-semibold text-foreground">Handle US Protected Health Info (ePHI)</span>
                      <Badge variant="outline" className="text-[9px] font-mono border-rose-500/30 text-rose-400">
                        HIPAA Rule
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Mandates Business Associate Agreements (BAA) and cryptographic storage safeguards.
                    </p>
                  </div>
                  <Switch checked={processesHealth} onCheckedChange={setProcessesHealth} />
                </div>

                {/* California Consumers */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-amber-400 shrink-0" />
                      <span className="text-xs font-semibold text-foreground">Serve California / US Retail Consumers</span>
                      <Badge variant="outline" className="text-[9px] font-mono border-amber-500/30 text-amber-400">
                        CCPA / CPRA
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Requires explicit Do-Not-Sell opt-out clauses and third-party sharing disclosures.
                    </p>
                  </div>
                  <Switch checked={processesUsConsumer} onCheckedChange={setProcessesUsConsumer} />
                </div>

                {/* AI / LLM Tech */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-purple-400 shrink-0" />
                      <span className="text-xs font-semibold text-foreground">Build, Fine-tune, or Deploy AI Models</span>
                      <Badge variant="outline" className="text-[9px] font-mono border-purple-500/30 text-purple-400">
                        EU AI Act 2024
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Activates High-Risk AI conformity assessments and human-in-the-loop oversight checks.
                    </p>
                  </div>
                  <Switch checked={developsAi} onCheckedChange={setDevelopsAi} />
                </div>
              </div>

              {/* Cloud selection */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-medium text-foreground">
                  Primary Cloud Infrastructure (For Compliance-as-Code scripts)
                </label>
                <div className="flex flex-wrap gap-2">
                  {["aws", "gcp", "azure", "onprem"].map((provider) => {
                    const active = cloudProviders.includes(provider);
                    return (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => toggleCloud(provider)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-mono font-medium transition-all ${
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
          )}

          {/* Step 3: Discovered Statutory Scope */}
          {step === 3 && (
            <div className="mt-6 space-y-5 animate-in fade-in duration-300">
              <div className="rounded-2xl border border-[var(--brass)]/30 bg-gradient-to-r from-[var(--brass)]/10 via-[var(--surface-raised)] to-[var(--brass)]/5 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brass)] text-black">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-display text-sm sm:text-base font-bold text-foreground">
                      Applicable Regulatory Scope Discovered
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Based on your operational profile, we have automatically activated{" "}
                      <span className="font-semibold text-[var(--brass)]">
                        {deducedFrameworkIds.length} Statutory Frameworks
                      </span>{" "}
                      for your contracts and blast radius engine.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {deducedFrameworkIds.map((id) => {
                  const meta = FRAMEWORK_DESCRIPTIONS[id] || {
                    title: id,
                    citation: "Statutory Instrument",
                    jurisdiction: "International",
                  };
                  return (
                    <div
                      key={id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/50 p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-[var(--brass)] shrink-0" />
                          <span className="text-xs font-semibold text-foreground truncate">
                            {meta.title}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-mono text-muted-foreground pl-6">
                          {meta.citation} · {meta.jurisdiction}
                        </p>
                      </div>
                      <Badge className="shrink-0 bg-[var(--brass)]/15 text-[var(--brass)] border-[var(--brass)]/30 font-mono text-[9px]">
                        ACTIVE
                      </Badge>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-muted-foreground italic text-center">
                Your workspace will start with a clean portfolio. You can update your compliance scope anytime in Settings.
              </p>
            </div>
          )}

          {/* Footer Controls */}
          <div className="mt-8 flex items-center justify-between border-t border-[var(--hairline)] pt-4">
            {step > 1 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                className="gap-1.5 border-[var(--hairline)] text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <Button
                size="sm"
                onClick={() => {
                  if (step === 1 && !entityName.trim()) {
                    toast.error("Please enter your organization name");
                    return;
                  }
                  setStep((s) => (s + 1) as 1 | 2 | 3);
                }}
                className="gap-1.5 bg-[var(--brass)] text-black hover:bg-[var(--brass)]/90 text-xs font-semibold"
              >
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={saveMutation.isPending}
                onClick={handleFinish}
                className="gap-1.5 bg-[var(--brass)] text-black hover:bg-[var(--brass)]/90 text-xs font-semibold shadow-[var(--glow-brass)]"
              >
                {saveMutation.isPending ? "Configuring..." : "Launch Clean Workspace"}
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
