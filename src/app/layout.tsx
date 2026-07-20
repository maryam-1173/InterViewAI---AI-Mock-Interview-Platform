import type { Metadata } from "next";
import "./globals.css";
import SiteNav from "@/components/site-nav";

// NOTE: this sandbox has no access to fonts.googleapis.com, so the type
// system falls back to a curated system-font stack defined in
// globals.css (--font-display / --font-body / --font-mono). To use the
// original Space Grotesk / Inter / IBM Plex Mono pairing once deployed
// with internet access, swap this block back to `next/font/google`:
//
//   import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
//   const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], weight: ["500","600","700"] });
//   const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400","500","600"] });
//   const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400","500"] });
// ...and add `${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable}` to the <html> className below.

export const metadata: Metadata = {
  title: "InterViewAI -- Practice the room before you're in it",
  description:
    "Multi-modal AI interview simulation with real-time speech, listening, and technical assessment, plus granular diagnostic feedback.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-ink text-paper">
        <SiteNav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
