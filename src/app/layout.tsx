import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "IntroMesh — warm intros through people you trust",
    template: "%s · IntroMesh",
  },
  description:
    "IntroMesh finds the warmest path to the person you want to meet, drafts the intro with AI, and pays the connector in USDC when the meeting happens. Built at Hacker House Goa 2026.",
  applicationName: "IntroMesh",
  openGraph: {
    title: "IntroMesh — your next customer is one trusted connection away",
    description: "AI-powered warm introductions with on-chain bounties. Hacker House Goa 2026.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05080f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg text-fg">
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!bg-surface-2/95 !backdrop-blur-xl !border !border-line-strong !text-fg !rounded-2xl !shadow-2xl",
              description: "!text-muted",
            },
          }}
        />
      </body>
    </html>
  );
}
