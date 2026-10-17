import Link from "next/link";
import { q } from "@/lib/db";
import { mvpInfoMany } from "@/lib/ps";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const pct = (rate: number) => (rate / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";

export default async function Tabelas() {
  const names = (await q<{ mvp: string }>(
    "SELECT mvp FROM kc UNION SELECT mvp FROM drops UNION SELECT mvp FROM history ORDER BY 1")).map((r) => r.mvp);
  const info = await mvpInfoMany(names);
  const failed = names.filter((n) => !info.get(n));
  const notFound = names.filter((n) => info.get(n) && !info.get(n)!.mob_id);

  return (
    <>
      <h1>Tabelas de drop</h1>
      <p className="sub">Drops de cada MVP no Payon Stories Tools, com o ID do item para buscar no jogo. Clique no MVP para abrir a tabela.</p>
      {failed.length > 0 && <p className="flash err">Não consegui carregar agora: {failed.join(", ")}. Recarregue a página para tentar de novo.</p>}
      {notFound.length > 0 && <p className="flash err">Não achei no site: {notFound.join(", ")}. Abra o MVP para colocar o ID do monstro manualmente.</p>}
      <div style={{ display: "grid", gap: 8 }}>
        {names.map((n) => {
          const i = info.get(n);
          return (
            <details key={n} className="panel" style={{ padding: "10px 14px" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                {n} <span className="dim" style={{ fontWeight: 400 }}>{i?.mob_id ? `· mob #${i.mob_id} · ${i.drops.length} itens` : i ? "· não encontrado" : "· erro ao carregar"}</span>
              </summary>
              {i && i.drops.length > 0 && (
                <div className="tbl" style={{ marginTop: 10 }}>
                  <table>
                    <thead><tr><th className="r">ID</th><th>Item</th><th className="r">Taxa</th></tr></thead>
                    <tbody>
                      {i.drops.map((d, k) => (
                        <tr key={k}><td className="r num"><b>{d.id}</b></td><td>{d.name}</td><td className="r num">{pct(d.rate)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="note" style={{ margin: "8px 0 0" }}><Link href={`/mvp/${encodeURIComponent(n)}`}>Abrir {n} → preços, seus drops e correção do ID</Link></p>
            </details>
          );
        })}
      </div>
      <p className="note" style={{ marginTop: 14 }}>Itens que caem direto no inventário (MVP reward) não aparecem na tabela do site. Esses você adiciona pelo ID.</p>
    </>
  );
}
