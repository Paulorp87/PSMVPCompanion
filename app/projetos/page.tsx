import Link from "next/link";
import { q } from "@/lib/db";
import { createProject } from "@/app/actions";
import { ITEM_TYPES, projectOdds, type ItemType } from "@/lib/refine";
import { STATIC_MVPS } from "@/lib/static-data";

export const dynamic = "force-dynamic";
const pct = (x: number) => (x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";

type P = { id: number; name: string; item_id: number; item_name: string; item_type: ItemType; target_refine: number; target_qty: number; status: string };

export default async function Projetos({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sp = await searchParams;
  const projects = await q<P>("SELECT id, name, item_id, item_name, item_type, target_refine, target_qty, status FROM projects ORDER BY status, created_at DESC");
  const units = await q<{ project_id: number; refine: number; status: string }>(
    "SELECT project_id, refine, status FROM drops WHERE project_id IS NOT NULL");
  const items = new Map<number, string>();
  for (const m of Object.values(STATIC_MVPS)) for (const d of m.drops) items.set(d.id, d.name);
  const opts = [...items.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <>
      <h1>Projetos</h1>
      <p className="sub">Junte itens para refinar e acompanhe a chance de chegar no refino que você quer.</p>
      {sp.e && <p className="flash err">Escolha o item do projeto.</p>}

      {projects.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {projects.map((p) => {
            const mine = units.filter((u) => u.project_id === p.id);
            const alive = mine.filter((u) => u.status === "projeto");
            const odds = projectOdds(p.item_type, alive.map((u) => u.refine), p.target_refine);
            return (
              <Link key={p.id} href={`/projetos/${p.id}`} className="panel" style={{ textDecoration: "none", display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 700 }}>{p.name} {p.status === "concluido" && <span className="pill">concluído</span>}</div>
                <div className="dim">{p.item_name} · {ITEM_TYPES[p.item_type].label}</div>
                <div className="num"><b>{alive.length}</b> de {p.target_qty} itens{mine.length > alive.length && <span className="dim"> · {mine.length - alive.length} quebrado(s)</span>}</div>
                <div style={{ height: 6, background: "var(--panel-2)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, (alive.length / p.target_qty) * 100)}%`, height: "100%", background: "var(--accent)" }} />
                </div>
                <div className="num">Chance de +{p.target_refine}: <b className="accent" style={{ color: "var(--accent)" }}>{odds.done ? "já conseguiu!" : pct(odds.chance)}</b></div>
              </Link>
            );
          })}
        </div>
      )}

      <h2>Novo projeto</h2>
      <form action={createProject} className="panel" style={{ display: "grid", gap: 10 }}>
        <div className="row">
          <label className="f" style={{ flex: "1 1 240px" }}>Item
            <select name="item_id" required defaultValue="">
              <option value="" disabled>Escolha o item</option>
              {opts.map(([id, n]) => <option key={id} value={id}>{n} (#{id})</option>)}
            </select>
          </label>
          <label className="f">Tipo
            <select name="item_type" defaultValue="w4">
              {Object.entries(ITEM_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </select>
          </label>
          <label className="f">Refino alvo
            <select name="target_refine" defaultValue="8">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>+{n}</option>)}
            </select>
          </label>
          <label className="f">Juntar quantos antes de tentar<input name="target_qty" type="number" min={1} defaultValue={10} style={{ width: 110 }} /></label>
        </div>
        <div className="row">
          <label className="f" style={{ flex: 1 }}>Nome (opcional)<input name="name" placeholder="ex.: Pick +8" /></label>
          <input type="hidden" name="item_name" value="" />
          <button className="btn">Criar projeto</button>
        </div>
        <p className="note" style={{ margin: 0 }}>O tipo define as chances e o minério: Arma Nv 4 usa Oridecon, armadura usa Elunium. Confira o nível da arma na Item Database se tiver dúvida.</p>
      </form>
    </>
  );
}
