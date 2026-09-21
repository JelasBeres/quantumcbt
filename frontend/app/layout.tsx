import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "mathlive/fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quantum Research CBT",
  description: "Computer Based Test Quantum Research",
  icons: {
    icon: "/quantum-research-logo.png",
    apple: "/quantum-research-logo.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
