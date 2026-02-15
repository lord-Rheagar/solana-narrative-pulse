import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solana Narrative Radar | Signal Detection Engine",
  description: "Detect emerging Solana ecosystem narratives from on-chain data, GitHub activity, and market signals. Get AI-generated build ideas for each trend.",
  keywords: ["Solana", "AI", "Narrative Detection", "Crypto", "DeFi", "Build Ideas"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
