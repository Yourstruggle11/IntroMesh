import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** The IntroMesh app mark (from the official icon kit in /public). */
export function LogoMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/icon-192x192.png"
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 rounded-[24%] shadow-[0_0_24px_-6px_rgba(46,230,182,0.55)]", className)}
    />
  );
}

/** Wordmark: "Intro" in white, "Mesh" in the logo's mint → blue → violet gradient. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-semibold tracking-tight", className)}>
      Intro
      <span className="bg-[linear-gradient(100deg,#2ee6b6_0%,#3bc8f0_50%,#7c83ff_100%)] bg-clip-text text-transparent">Mesh</span>
    </span>
  );
}

export function Logo({ href = "/", className, showText = true }: { href?: string; className?: string; showText?: boolean }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="IntroMesh home">
      <LogoMark className="transition-transform duration-500 group-hover:scale-105 group-hover:rotate-[4deg]" />
      {showText && <Wordmark className="text-[17px]" />}
    </Link>
  );
}
