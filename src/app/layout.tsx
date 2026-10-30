import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import { absoluteUrl } from "@/lib/utils";
import "./globals.css";

const description =
  "IntroMesh finds the warmest path to the person you want to meet, drafts the intro with AI, and pays the connector in USDC when the meeting happens. Built at Hacker House Goa 2026.";

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl("/")),
  title: {
    default: "IntroMesh — warm intros through people you trust",
    template: "%s · IntroMesh",
  },
  description,
  applicationName: "IntroMesh",
  manifest: "/site.webmanifest",
  icons: {
    // /favicon.ico is added automatically from src/app/favicon.ico
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "IntroMesh", statusBarStyle: "black-translucent" },
  openGraph: {
    title: "IntroMesh — your next customer is one trusted connection away",
    description: "AI-powered warm introductions with on-chain USDC bounties. Built at Hacker House Goa 2026.",
    type: "website",
    siteName: "IntroMesh",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "IntroMesh" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "IntroMesh — warm intros through people you trust",
    description: "AI-powered warm introductions with on-chain USDC bounties. Built at Hacker House Goa 2026.",
    images: ["/twitter-card.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#04060F",
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
