import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { startContractExtraction } from "@/lib/upload.functions";
import { handlePlanLimitError } from "@/components/PlanLimitDialog";
import { FileUp, FileText, FileCheck } from "lucide-react";

type Props = { onClose: () => void };

export function UploadContract({ onClose }: Props) {
  const [name, setName] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [value, setValue] = useState("");
  const [rawText, setRawText] = useState("");
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSizeStr, setFileSizeStr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const start = useServerFn(startContractExtraction);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      return start({
        data: {
          name,
          counterparty,
          value: Number(value),
          rawText: rawText || null,
          fileBase64,
          fileName,
          sourceFilePath: fileName,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      onClose();
    },
    onError: (err) => {
      if (handlePlanLimitError(err, "contracts")) {
        onClose();
        return;
      }
      setError(err instanceof Error ? err.message : "Upload failed");
    },
  });

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Enforce 10 MB limit (Phase 4 T4.6)
    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds 10 MB limit. Please select a smaller document.");
      return;
    }

    setFileName(file.name);
    setFileSizeStr(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);
    if (!name) setName(file.name.replace(/\.[^.]+$/, ""));

    const isText =
      file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md");

    if (isText) {
      const text = await file.text();
      setRawText(text);
      setFileBase64(null);
    } else if (
      file.name.endsWith(".pdf") ||
      file.name.endsWith(".docx") ||
      file.type === "application/pdf"
    ) {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        const b64 = res.split(",")[1];
        setFileBase64(b64);
      };
      reader.readAsDataURL(file);
    } else {
      setError("Unsupported format. Please upload a PDF, DOCX, or TXT file (max 10 MB).");
    }
  }

  const canSubmit =
    Boolean(name) &&
    Boolean(counterparty) &&
    Boolean(value) &&
    (rawText.length >= 40 || Boolean(fileBase64));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-base/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <FileUp className="h-5 w-5 text-brass" />
          <h2 className="font-display text-2xl text-text-primary">Upload Contract</h2>
        </div>
        <p className="mb-5 text-sm text-text-muted">
          Upload PDF, DOCX, or TXT (up to 10 MB). The server validates magic bytes, extracts text,
          and calculates clause span coordinates with background job durability.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-text-muted">Name</span>
              <input
                className="mt-1 w-full glass-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enterprise Cloud SLA"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-text-muted">Counterparty</span>
              <input
                className="mt-1 w-full glass-input"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Aegis Infrastructure Ltd."
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-text-muted">
              Contract value (USD)
            </span>
            <input
              type="number"
              className="mt-1 w-full glass-input font-mono"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="2500000"
            />
          </label>

          <div className="rounded-xl border border-[var(--hairline)] p-4 bg-[rgba(255,255,255,0.015)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-brass" /> Source Document (PDF, DOCX, TXT ≤ 10
                MB)
              </span>
              {fileSizeStr && (
                <span className="font-mono text-[11px] text-muted-foreground">{fileSizeStr}</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,application/pdf"
                onChange={onFileChange}
                className="text-sm text-text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brass file:text-black file:font-medium file:cursor-pointer hover:file:opacity-90"
              />
            </div>

            {fileName && (
              <div className="flex items-center gap-2 pt-1 font-mono text-xs text-brass">
                <FileCheck className="h-4 w-4 text-emerald-400" />
                <span>Selected: {fileName}</span>
              </div>
            )}
          </div>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-text-muted">
              Or paste text directly (optional if uploading PDF/DOCX)
            </span>
            <textarea
              className="mt-1 w-full glass-input min-h-[140px] font-mono text-xs"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw contract text here, or select a file above…"
            />
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              className="rounded-[12px] px-4 py-2 text-text-muted transition hover:text-text-primary"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-[var(--brass)] px-5 py-2 font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition hover:bg-[var(--brass-strong)] disabled:opacity-50"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !canSubmit}
            >
              {mutation.isPending ? "Extracting Clauses…" : "Analyze Contract"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
