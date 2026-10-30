import Link from "next/link";
import { q } from "@/lib/db";
import { getCharacters, knownMvps, todayChicago } from "@/lib/data";
import { deleteDrop } from "@/app/actions";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/status";
import DropForm from "./DropForm";
import DropRow, { type DropRowData } from "./DropRow";
import ImportHistory from "./ImportHistory";
import { TAMING } from "@/lib/taming";
import { BOXES } from "@/lib/boxes";

export const dynamic = "force-dynamic";

export default async function Drops({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string; mvp?: string; status?: string }> }) {
  const sp = await searchParams;
  const filter = sp.status === "todos" ? null : (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as Status) : "sem_status";
  const [mvps, chars, rows, counts, projects, hist] = await Promise.all([
    knownMvps(),
    getCharacters(),
    q<DropRowData>(
      `SELECT d.id, to_char(d.dropped_on,'YYYY-MM-DD') AS dropped_on, d.mvp, d.item_id, d.item_name, d.qty, c.name AS char,
              d.status, d.sold_price::float8 AS sold_price, d.split, d.project_id, d.source, d.refine, d.capture, d.opened_name
       FROM drops d LEFT JOIN characters c ON c.id=d.character_id
       WHERE ($1::text IS NULL OR d.status=$1) ORDER BY d.dropped_on DESC, d.id DESC LIMIT 300`, [filter]),
    q<{ status: string; n: number }>("SELECT status, SUM(qty)::int AS n FROM drops GROUP BY status"),
    q<{ id: number; name: string; item_id: number }>("SELECT id, name, item_id FROM projects WHERE status='juntando' ORDER BY name"),
    q<{ character_id: number; char: string; mvp: string; item_id: number; item_name: string; free: number }>(
      `SELECT h.character_id, c.name AS char, h.mvp, h.item_id, h.item_name,
              (h.qty - COALESCE((SELECT SUM(qty) FROM drops d WHERE d.source='history' AND d.character_id=h.character_id
                                  AND d.mvp=h.mvp AND d.item_id=h.item_id),0))::int AS free
       FROM history h JOIN characters c ON c.id=h.character_id ORDER BY c.name, h.mvp, h.item_name`),
  ]);
  const caps = await q<{ item_id: number; ok: number; fail: number }>(
    `SELECT item_id, COALESCE(SUM(qty) FILTER (WHERE capture='sucesso'),0)::int AS ok, COALESCE(SUM(qty) FILTER (WHERE capture='falha'),0)::int AS fail
     FROM drops WHERE capture IS NOT NULL GROUP BY item_id`);
  const opened = await q<{ item_id: number; opened_id: number; opened_name: string; n: number }>(
    `SELECT item_id, opened_id, opened_name, SUM(qty)::int AS n FROM drops WHERE opened_id IS NOT NULL
     GROUP BY item_id, opened_id, opened_name ORDER BY n DESC, opened_name`);
  const count = new Map(counts.map((c) => [c.status, c.n]));
  const total = counts.reduce((a, c) => a + c.n, 0);

  return (
    <>
      <h1>Drops</h1>
      <p className="sub">Registre o que caiu e dê destino a cada item: guardar, vender, levar pra loja, usar num projeto.</p>
      {sp.ok && <p className="flash">Drop registrado.</p>}
      {sp.e && <p className="flash err">Faltou escolher o MVP ou o item.</p>}
      <DropForm mvps={mvps} chars={chars.map((c) => ({ id: c.id, name: c.name }))} today={todayChicago()} initialMvp={sp.mvp} />

      <h2>Seus drops</h2>
      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        {STATUSES.map((s) => (
          <Link key={s} href={`/drops?status=${s}`} className={`btn small ${filter === s ? "" : "ghost"}`}>{STATUS_LABEL[s]} ({count.get(s) ?? 0})</Link>
        ))}
        <Link href="/drops?status=todos" className={`btn small ${filter ? "ghost" : ""}`}>Todos ({total})</Link>
      </div>
      {rows.length === 0 ? <p className="note">Nenhum drop {filter ? `com status "${STATUS_LABEL[filter]}"` : "registrado ainda"}.</p> : (
        <div className="tbl">
          <table>
            <thead><tr><th>Data</th><th>MVP / personagem</th><th>Item</th><th className="r">Qtd</th><th>Destino</th><th className="r" title="Dividido entre quantas pessoas">Dividir</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <DropRow key={`${r.id}-${r.qty}-${r.status}-${r.project_id}-${r.split}-${r.sold_price}-${r.capture}`} d={r} projects={projects}
                  onDelete={<form action={deleteDrop} style={{ display: "inline" }}><input type="hidden" name="id" value={r.id} /><button className="btn ghost small" title="Apagar">✕</button></form>} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">Com quantidade maior que 1, mude o número na coluna Qtd para aplicar o destino só a parte dos itens. "Dividir" é o número de pessoas que dividem o item, e na rentabilidade entra só a sua parte. Em item de captura, "Usei" pergunta se capturou: se sim, o ovo entra na lista como Sem status.</p>

      {caps.length > 0 && (
        <>
          <h2>Capturas</h2>
          <div className="tbl">
            <table>
              <thead><tr><th>Pet</th><th>Item</th><th className="r">Tentativas</th><th className="r">Capturas</th><th className="r">Taxa</th></tr></thead>
              <tbody>
                {caps.map((c) => {
                  const t = TAMING[c.item_id]; const tries = c.ok + c.fail;
                  return (
                    <tr key={c.item_id}>
                      <td>{t?.pet ?? "—"}</td><td className="dim">#{c.item_id}</td>
                      <td className="r num">{tries}</td><td className="r num up">{c.ok}</td>
                      <td className="r num">{tries ? Math.round((c.ok / tries) * 100) + "%" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {opened.length > 0 && Object.entries(BOXES).map(([bid, b]) => {
        const list = opened.filter((o) => o.item_id === Number(bid));
        if (!list.length) return null;
        const price = (id: number) => b.items.find((c) => c.id === id)?.price ?? null;
        const n = list.reduce((a, o) => a + o.n, 0);
        const val = list.reduce((a, o) => a + (price(o.opened_id) ?? 0) * o.n, 0);
        const known = b.items.filter((c) => c.price != null);
        const avg = known.reduce((a, c) => a + (c.price ?? 0), 0) / (known.length || 1);
        return (
          <div key={bid}>
            <h2>{b.name}: o que saiu</h2>
            <p className="note">{n} aberto(s). Valor das cartas que saíram: {Math.round(val).toLocaleString("pt-BR")} z
              ({Math.round(val / n).toLocaleString("pt-BR")} z por álbum). Média de preço das {known.length} cartas com venda: {Math.round(avg).toLocaleString("pt-BR")} z.
              As cartas entram nos drops como Sem status, mas ficam fora da rentabilidade (lá conta o valor do álbum).</p>
            <div className="tbl"><table>
              <thead><tr><th>Carta</th><th className="r">Qtd</th><th className="r">Preço</th></tr></thead>
              <tbody>{list.map((o) => (
                <tr key={o.opened_id}><td>{o.opened_name} <span className="dim">#{o.opened_id}</span></td><td className="r num">{o.n}</td>
                  <td className="r num">{price(o.opened_id) != null ? Math.round(price(o.opened_id)!).toLocaleString("pt-BR") : "—"}</td></tr>
              ))}</tbody>
            </table></div>
          </div>
        );
      })}

      <h2>Importar do histórico</h2>
      <ImportHistory rows={hist} projects={projects} />
    </>
  );
}
