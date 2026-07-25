import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startContractExtraction } from "@/lib/upload.functions";
import { profileQuery } from "@/data/queries";
import { useQuery } from "@tanstack/react-query";

type Props = { onClose: () => void };

export function UploadContract({ onClose }: Props) {
  const [name, setName] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [value, setValue] = useState("");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const start = useServerFn(startContractExtraction);
  const qc = useQueryClient();
  const { data: profile } = useQuery(profileQuery);

  const mutation = useMutation({
    mutationFn: async () => {
      let sourceFilePath: string | null = null;
      const file = fileRef.current?.files?.[0];
      if (file && profile?.org?.id) {
        const path = `${profile.org.id}/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("contract-files")
          .upload(path, file, { contentType: file.type || "text/plain" });
        if (upErr) throw upErr;
        sourceFilePath = path;
      }
      return start({
        data: {
          name,
          counterparty,
          value: Number(value),
          rawText,
          sourceFilePath,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Upload failed"),
  });

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      const text = await file.text();
      setRawText(text);
      if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
    } else {
      setError("Only .txt/.md supported right now. Paste the contract text below.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-base/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-2xl text-text-primary mb-1">Upload Contract</h2>
        <p className="text-text-muted text-sm mb-5">
          AI will segment clauses and link them to regulations in your ontology.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-text-muted">Name</span>
              <input
                className="mt-1 w-full glass-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Q3 2026 Services Agreement"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-text-muted">Counterparty</span>
              <input
                className="mt-1 w-full glass-input"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Acme Corp."
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-text-muted">Contract value (USD)</span>
            <input
              type="number"
              className="mt-1 w-full glass-input font-mono"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="2500000"
            />
          </label>

          <div>
            <span className="text-xs uppercase tracking-wider text-text-muted">Source file</span>
            <div className="mt-1 flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,text/plain"
                onChange={onFileChange}
                className="text-sm text-text-muted"
              />
              {fileName ? <span className="font-mono text-xs text-brass">{fileName}</span> : null}
            </div>
            <p className="text-xs text-text-muted mt-1">
              .txt / .md supported now. PDF & DOCX support planned.
            </p>
          </div>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-text-muted">Contract text</span>
            <textarea
              className="mt-1 w-full glass-input min-h-[180px] font-mono text-xs"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste the raw contract text here…"
            />
          </label>

          {error ? <p className="text-risk-red text-sm">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              className="px-4 py-2 rounded-lg text-text-muted hover:text-text-primary transition"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </button>
            <button
              className="px-5 py-2 rounded-lg bg-brass/90 text-ink-base font-medium hover:bg-brass transition disabled:opacity-50"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !name || !counterparty || !value || rawText.length < 40}
            >
              {mutation.isPending ? "Uploading…" : "Analyze Contract"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
