import { Lock } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type VizNode = {
  id: string;
  name: string;
  sub?: string | null;
  masked?: boolean;
  role: "you" | "hop" | "connector" | "target";
};

const ROLE_LABEL: Record<VizNode["role"], string> = {
  you: "You",
  hop: "Mutual",
  connector: "Connector",
  target: "Target",
};

const ROLE_RING: Record<VizNode["role"], string> = {
  you: "ring-brand/60",
  hop: "ring-white/15",
  connector: "ring-brand-3/60",
  target: "ring-gold/60",
};

export function PathViz({ nodes, size = "md", className }: { nodes: VizNode[]; size?: "sm" | "md"; className?: string }) {
  const av = size === "sm" ? 30 : 40;
  return (
    <div className={cn("flex flex-col items-stretch gap-0 sm:flex-row sm:items-center", className)}>
      {nodes.map((n, i) => (
        <div key={n.id + i} className="flex flex-col sm:flex-1 sm:flex-row sm:items-center">
          <div className={cn("flex min-w-0 items-center gap-2.5 sm:flex-col sm:gap-1.5 sm:text-center", size === "sm" && "sm:gap-1")}>
            <span className={cn("relative rounded-full ring-2 ring-offset-2 ring-offset-surface", ROLE_RING[n.role])}>
              <Avatar name={n.name} seed={n.id} size={av} masked={n.masked} />
              {n.role === "target" && <span className="absolute -inset-1 -z-10 animate-pulse-ring rounded-full bg-gold/30" />}
            </span>
            <div className="min-w-0 sm:max-w-[9.5rem]">
              <p className="truncate text-[13px] font-medium leading-tight">
                {n.masked && <Lock className="mr-1 inline h-3 w-3 -translate-y-px text-muted" aria-label="private" />}
                {n.name}
              </p>
              <p className="truncate text-[11px] leading-tight text-muted">{n.sub || ROLE_LABEL[n.role]}</p>
            </div>
          </div>
          {i < nodes.length - 1 && (
            <>
              <div
                className="my-1 h-6 w-[2px] animate-flow-y rounded-full sm:hidden"
                style={{
                  marginLeft: av / 2 + 1,
                  backgroundImage: "repeating-linear-gradient(180deg, rgba(45,212,191,0.9) 0 10px, rgba(167,139,250,0.25) 10px 24px)",
                  backgroundSize: "100% 48px",
                }}
              />
              <div
                className="mx-2 hidden h-[2px] min-w-6 flex-1 animate-flow-x rounded-full sm:block"
                style={{
                  backgroundImage: "repeating-linear-gradient(90deg, rgba(45,212,191,0.9) 0 10px, rgba(167,139,250,0.25) 10px 24px)",
                  backgroundSize: "48px 100%",
                }}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
