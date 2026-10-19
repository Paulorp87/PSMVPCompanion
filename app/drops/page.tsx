import Link from "next/link";
import { q } from "@/lib/db";
import { getCharacters, knownMvps, todayChicago } from "@/lib/data";
import { deleteDrop } from "@/app/actions";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/status";
import DropForm from "./DropForm";
import DropRow, { type DropRowData } from "./DropRow";
import ImportHistory from "./ImportHistory";

export const dynamic = "force-dynamic";

export default async function Drops({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string; mvp?: string; status?: string }> }) {
  const sp = await searchParams;
  const filter = sp.status === "todos" ? null : (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as Status) : "sem_status";
  const [mvps, chars, rows, counts, projects, hist] = await Promise.all([
    knownMvps(),
    getCharacters(),
    q<DropRowData>(
      `SELECT d.id, to_char(d.dropped_on,'YYYY-MM-DD') AS dropped_on, d.mvp, d.item_id, d.item_name, d.qty, c.name AS char,
              d.status, d.sold_price::float8 AS sold_price, d.split, d.project_id, d.source, d.refine
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
                <DropRow key={`${r.id}-${r.qty}-${r.status}-${r.project_id}-${r.split}-${r.sold_price}`} d={r} projects={projects}
                  onDelete={<form action={deleteDrop} style={{ display: "inline" }}><input type="hidden" name="id" value={r.id} /><button className="btn ghost small" title="Apagar">✕</button></form>} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">Com quantidade maior que 1, mude o número na coluna Qtd para aplicar o destino só a parte dos itens. "Dividir" é o número de pessoas que dividem o item, e na rentabilidade entra só a sua parte.</p>

      <h2>Importar do histórico</h2>
      <ImportHistory rows={hist} projects={projects} />
    </>
  );
}
