import QRCode from "qrcode";
import { LogoMark } from "@/components/brand/logo";
import { CopyButton } from "@/components/ui/client";

export async function QrCard({ name, headline, code, url }: { name: string; headline: string | null; code: string; url: string }) {
  const svg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#05080f", light: "#ffffff" } });
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-brand-gradient opacity-25 blur-3xl" />
      <div className="ring-gradient relative overflow-hidden rounded-[2rem] bg-surface-2 p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <LogoMark size={30} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{name}</p>
            <p className="truncate text-xs text-muted">{headline || "Member of the mesh"}</p>
          </div>
        </div>
        <div className="mt-5 rounded-3xl bg-white p-5 shadow-inner">
          {/* QR SVG generated server-side from our own URL */}
          <div className="aspect-square w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
        <div className="mt-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Connect code</p>
            <p className="font-mono text-2xl font-semibold tracking-[0.3em] text-gradient">{code}</p>
          </div>
          <CopyButton value={url} label="Copy link" toastText="Connect link copied" />
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted">Ask them to scan with their phone camera. Both of you consent — that&apos;s a trusted edge.</p>
    </div>
  );
}
