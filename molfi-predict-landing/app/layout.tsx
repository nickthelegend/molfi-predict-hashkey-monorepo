import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";


const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Molfi — Private, agent-native prediction markets on HashKey Chain",
  description:
    "Bet on real-world outcomes with your side hidden on-chain behind a commitment, and claim winnings with a zero-knowledge proof. Agent-native, ZK-verified, and HSP-settled on HashKey Chain.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Molfi — Private, agent-native prediction markets on HashKey Chain",
    description:
      "Your side (YES/NO) stays hidden on-chain. Your proof is public. Three real ZK mechanisms verified on HashKey Chain, and an SDK + MCP server that lets an agent bet and redeem with no human in the loop.",
    siteName: "Molfi",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Molfi — Private, agent-native prediction markets on HashKey Chain",
    description:
      "Bet in private. Your side stays hidden. Your proof is on-chain. Agent-native prediction markets on HashKey Chain.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${manrope.variable} ${inter.variable} antialiased bg-background font-body`}
      >
        {children}
      </body>
    </html>
  );
}
