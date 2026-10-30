import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="im-g" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5EEAD4" />
          <stop offset="0.55" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#im-g)" opacity="0.14" />
      <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" stroke="url(#im-g)" strokeOpacity="0.5" />
      <path d="M9 22 L14 11 L23 13 L20 22 Z M14 11 L20 22" stroke="url(#im-g)" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="9" cy="22" r="2.6" fill="#5EEAD4" />
      <circle cx="14" cy="11" r="2.3" fill="#22D3EE" />
      <circle cx="23" cy="13" r="2.3" fill="#818CF8" />
      <circle cx="20" cy="22" r="2.6" fill="#A78BFA" />
    </svg>
  );
}

export function Logo({ href = "/", className, showText = true }: { href?: string; className?: string; showText?: boolean }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="IntroMesh home">
      <LogoMark className="transition-transform duration-500 group-hover:rotate-[8deg]" />
      {showText && (
        <span className="text-[17px] font-semibold tracking-tight">
          Intro<span className="text-gradient">Mesh</span>
        </span>
      )}
    </Link>
  );
}
