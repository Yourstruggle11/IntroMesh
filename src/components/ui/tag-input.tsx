"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function TagInput({
  value,
  onChange,
  placeholder,
  max = 12,
  tone = "brand",
  id,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
  tone?: "brand" | "violet" | "gold";
  id?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw
      .split(/,|\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase()) && next.length < max) next.push(p.slice(0, 48));
    onChange(next);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  const chip = {
    brand: "border-brand/30 bg-brand/10 text-brand",
    violet: "border-brand-3/30 bg-brand-3/10 text-brand-3",
    gold: "border-gold/30 bg-gold/10 text-gold",
  }[tone];
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-white/[0.03] px-2 py-1.5 transition focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10">
      {value.map((t) => (
        <span key={t} className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs", chip)}>
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="opacity-70 hover:opacity-100" aria-label={`Remove ${t}`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => add(draft)}
        placeholder={value.length ? "" : placeholder}
        className="h-7 min-w-[8rem] flex-1 bg-transparent px-1.5 text-fg outline-none placeholder:text-subtle"
      />
    </div>
  );
}
