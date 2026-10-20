import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "PS Companion", description: "Companion pessoal do Payon Stories: KC de MVP, drops, projetos e rentabilidade" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="top">
          <div className="in">
            <Link href="/" className="brand">PS <span>Companion</span></Link>
            <nav>
              <Link href="/">Personagens</Link>
              <Link href="/mvps">Total por MVP</Link>
              <Link href="/rapido">Drop rápido</Link>
              <Link href="/drops">Drops</Link>
              <Link href="/estoque">Estoque</Link>
              <Link href="/tabelas">Tabelas de drop</Link>
              <Link href="/projetos">Projetos</Link>
              <Link href="/rentabilidade">Rentabilidade</Link>
              <Link href="/estatisticas">Estatísticas</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
