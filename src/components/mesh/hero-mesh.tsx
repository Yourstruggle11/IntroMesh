"use client";

import { useEffect, useRef } from "react";

type Node = { x: number; y: number; bx: number; by: number; r: number; phase: number; label?: string; sub?: string; key?: "you" | "target" | "hop" };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const LABELS: { label: string; sub: string }[] = [
  { label: "Priya", sub: "Founder · Base" },
  { label: "Arjun", sub: "DevRel · TigerGraph" },
  { label: "Maya", sub: "Partner · Seed fund" },
  { label: "Leo", sub: "BD · Dodo" },
  { label: "Sara", sub: "Privacy · Cake" },
];

export function HeroMesh({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let nodes: Node[] = [];
    let edges: [number, number][] = [];
    let path: number[] = [];
    let raf = 0;
    let visible = true;
    let t0 = performance.now();

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rand = rng(7);
      const count = Math.round(Math.min(64, Math.max(26, (w * h) / 16000)));
      nodes = Array.from({ length: count }, () => {
        const x = rand() * w;
        const y = rand() * h;
        return { x, y, bx: x, by: y, r: 1.4 + rand() * 1.8, phase: rand() * Math.PI * 2 };
      });
      // Anchor a visible warm path. On wide screens keep it to the right of the hero copy.
      const wide = w >= 900;
      const anchors: [number, number][] = wide
        ? [
            [0.56, 0.6],
            [0.67, 0.34],
            [0.8, 0.52],
            [0.91, 0.2],
          ]
        : [
            [0.12, 0.7],
            [0.34, 0.42],
            [0.58, 0.58],
            [0.82, 0.3],
          ];
      path = anchors.map(([ax, ay], i) => {
        const n: Node = { x: ax * w, y: ay * h, bx: ax * w, by: ay * h, r: i === 0 || i === anchors.length - 1 ? 5 : 3.6, phase: i };
        n.key = i === 0 ? "you" : i === anchors.length - 1 ? "target" : "hop";
        n.label = i === 0 ? "You" : LABELS[i % LABELS.length].label;
        n.sub = i === 0 ? "looking for a Solana VC" : i === anchors.length - 1 ? "Partner · Seed fund" : LABELS[(i + 2) % LABELS.length].sub;
        nodes.push(n);
        return nodes.length - 1;
      });
      edges = [];
      const maxD = Math.min(170, Math.max(110, w / 7));
      for (let i = 0; i < nodes.length; i++) {
        let links = 0;
        for (let j = i + 1; j < nodes.length && links < 4; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          if (dx * dx + dy * dy < maxD * maxD) {
            edges.push([i, j]);
            links++;
          }
        }
      }
      for (let i = 0; i < path.length - 1; i++) edges.push([path[i], path[i + 1]]);
    };

    const draw = (now: number) => {
      // rAF timestamps can precede t0 slightly; clamp so progress never goes negative.
      const t = Math.max(0, (now - t0) / 1000);
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        const amp = n.key ? 3 : 7;
        n.x = n.bx + Math.sin(t * 0.35 + n.phase) * amp;
        n.y = n.by + Math.cos(t * 0.3 + n.phase * 1.3) * amp;
      }
      // base mesh
      for (const [a, b] of edges) {
        const A = nodes[a];
        const B = nodes[b];
        const onPath = path.includes(a) && path.includes(b) && Math.abs(path.indexOf(a) - path.indexOf(b)) === 1;
        if (onPath) continue;
        ctx.strokeStyle = "rgba(148, 197, 255, 0.07)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      }
      // warm path
      const cycle = 4.2;
      const prog = reduced ? 1 : (t % cycle) / cycle; // 0..1 along the whole path
      const segs = path.length - 1;
      for (let i = 0; i < segs; i++) {
        const A = nodes[path[i]];
        const B = nodes[path[i + 1]];
        const g = ctx.createLinearGradient(A.x, A.y, B.x, B.y);
        g.addColorStop(0, "rgba(45,212,191,0.75)");
        g.addColorStop(1, "rgba(167,139,250,0.75)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 6]);
        ctx.lineDashOffset = reduced ? 0 : -t * 18;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // traveling pulse
      if (!reduced) {
        const pos = prog * segs;
        const i = Math.max(0, Math.min(Math.floor(pos), segs - 1));
        const f = pos - i;
        const A = nodes[path[i]];
        const B = nodes[path[i + 1]];
        const px = A.x + (B.x - A.x) * f;
        const py = A.y + (B.y - A.y) * f;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 22);
        glow.addColorStop(0, "rgba(94,234,212,0.9)");
        glow.addColorStop(1, "rgba(94,234,212,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e6fffb";
        ctx.beginPath();
        ctx.arc(px, py, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // nodes
      for (const n of nodes) {
        if (n.key) continue;
        ctx.fillStyle = "rgba(186, 214, 255, 0.35)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let k = 0; k < path.length; k++) {
        const n = nodes[path[k]];
        const isEnd = n.key === "you" || n.key === "target";
        const color = n.key === "you" ? "45,212,191" : n.key === "target" ? "251,191,36" : "167,139,250";
        const pulse = reduced ? 0 : (Math.sin(t * 2 + k) + 1) / 2;
        ctx.fillStyle = `rgba(${color},${0.12 + pulse * 0.12})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * (isEnd ? 4 : 3), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgb(${color})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
        if (w >= 900 && n.label) {
          ctx.font = "11px var(--font-geist-sans), system-ui, sans-serif";
          const subW = ctx.measureText(n.sub ?? "").width;
          const flip = n.x + 14 + Math.max(subW, 60) > w - 8; // not enough room on the right
          ctx.textAlign = flip ? "right" : "left";
          const lx = flip ? n.x - 12 : n.x + 12;
          ctx.font = "600 12px var(--font-geist-sans), system-ui, sans-serif";
          ctx.fillStyle = "rgba(232,238,247,0.95)";
          ctx.fillText(n.label, lx, n.y - 6);
          ctx.font = "11px var(--font-geist-sans), system-ui, sans-serif";
          ctx.fillStyle = "rgba(139,152,173,0.95)";
          ctx.fillText(n.sub ?? "", lx, n.y + 9);
          ctx.textAlign = "left";
        }
      }
      if (visible && !reduced) raf = requestAnimationFrame(draw);
    };

    build();
    t0 = performance.now();
    raf = requestAnimationFrame(draw);

    const ro = new ResizeObserver(() => {
      build();
      if (reduced) draw(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !reduced) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(draw);
      }
    });
    io.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
