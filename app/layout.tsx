import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "MVP KC — Payon Stories", description: "Controle pessoal de KC de MVP e drops" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="top">
          <div className="in">
            <Link href="/" className="brand">MVP <span>KC</span></Link>
            <nav>
              <Link href="/">Personagens</Link>
              <Link href="/mvps">Total por MVP</Link>
              <Link href="/drops">Drops</Link>
              <Link href="/rentabilidade">Rentabilidade</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
