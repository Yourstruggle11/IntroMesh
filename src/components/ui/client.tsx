"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import * as RDialog from "@radix-ui/react-dialog";
import { animate, useInView } from "motion/react";
import { Check, Copy, Mic, MicOff, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ───────────── Animated number ───────────── */
export function AnimatedNumber({ value, decimals = 0, prefix = "", suffix = "", className }: { value: number; decimals?: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const prev = useRef(0);
  useEffect(() => {
    if (!inView || !ref.current) return;
    const node = ref.current;
    const controls = animate(prev.current, value, {
      duration: 1.1,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        node.textContent = `${prefix}${v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
      },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, inView, decimals, prefix, suffix]);
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {(0).toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ───────────── Copy button ───────────── */
export function CopyButton({ value, label, className, toastText = "Copied" }: { value: string; label?: string; className?: string; toastText?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          toast.success(toastText);
          setTimeout(() => setDone(false), 1600);
        } catch {
          toast.error("Couldn't copy — select and copy manually.");
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.04] px-2.5 py-1.5 text-xs text-muted transition hover:border-line-strong hover:text-fg",
        className,
      )}
    >
      {done ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {label ?? (done ? "Copied" : "Copy")}
    </button>
  );
}

/* ───────────── Dialog ───────────── */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[fade-up_0.2s_ease-out]" />
        <RDialog.Content
          className={cn(
            "glass-strong fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl p-5 shadow-2xl outline-none safe-bottom",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6",
            "data-[state=open]:animate-fade-up",
            className,
          )}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RDialog.Title className="text-lg font-semibold tracking-tight">{title}</RDialog.Title>
              {description ? <RDialog.Description className="mt-1 text-sm text-muted">{description}</RDialog.Description> : <RDialog.Description className="sr-only">Dialog</RDialog.Description>}
            </div>
            <RDialog.Close className="rounded-lg p-1.5 text-muted transition hover:bg-white/5 hover:text-fg" aria-label="Close">
              <X className="h-4 w-4" />
            </RDialog.Close>
          </div>
          {children}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/* ───────────── Dictation (Web Speech API; Wispr Flow works in any field too) ───────────── */
type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

export function DictationButton({ onText, className }: { onText: (text: string) => void; className?: string }) {
  // "unknown" until the effect runs: the server and the first render must commit to neither branch.
  const [speech, setSpeech] = useState<"unknown" | "yes" | "no">("unknown");
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSpeech("no");
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      if (text.trim()) onText(text.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      if (e.error !== "aborted" && e.error !== "no-speech") toast.error("Microphone unavailable — try Wispr Flow or type instead.");
    };
    recRef.current = rec;
    setSpeech("yes");
    return () => rec.stop();
  }, [onText]);

  if (speech === "unknown") return null;
  // No Web Speech API (Safari, Firefox): Wispr Flow still dictates into the focused field.
  if (speech === "no")
    return (
      <span
        title="Wispr Flow dictates into any focused field, in any app"
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white/[0.04] px-3 text-xs font-medium text-subtle",
          className,
        )}
      >
        <Mic className="h-3.5 w-3.5" /> Works with Wispr Flow
      </span>
    );
  return (
    <button
      type="button"
      onClick={() => {
        const rec = recRef.current;
        if (!rec) return;
        if (listening) {
          rec.stop();
          setListening(false);
        } else {
          try {
            rec.start();
            setListening(true);
          } catch {
            /* already started */
          }
        }
      }}
      className={cn(
        "relative inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition",
        listening ? "border-danger/40 bg-danger/10 text-danger" : "border-line bg-white/[0.04] text-muted hover:text-fg",
        className,
      )}
      aria-pressed={listening}
    >
      {listening && <span className="absolute -inset-px animate-pulse-ring rounded-xl border border-danger/40" />}
      {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
      {listening ? "Stop" : "Dictate"}
    </button>
  );
}
