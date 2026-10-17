import Link from "next/link";
import { notFound } from "next/navigation";
import { q } from "@/lib/db";
import { setProjectStatus } from "@/app/actions";
import { ITEM_TYPES, chanceOne, attemptsOne, projectOdds, type ItemType } from "@/lib/refine";
import { UnitRow, AddFromStock } from "./ProjectItems";

export const dynamic = "force-dynamic";
const pct = (x: number) => (x * 100).toLocaleString("pt-BR", { maximumFractionDigits: x < 0.01 ? 3 : 1 }) + "%";
const n = (x: number) => Math.round(x).toLocaleString("pt-BR");
const nk = (x: number) => x >= 1e6 ? (x / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "M" : x >= 1e3 ? (x / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "K" : n(x);

type P = { id: number; name: string; item_id: number; item_name: string; item_type: ItemType; target_refine: number; target_qty: number; status: string };

export default async function Projeto({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const p = (await q<P>("SELECT id, name, item_id, item_name, item_type, target_refine, target_qty, status FROM projects WHERE id=$1", [id]))[0];
  if (!p) notFound();
  const t = ITEM_TYPES[p.item_type] ?? ITEM_TYPES.w4;
  const [units, stock, priceRows] = await Promise.all([
    q<{ id: number; refine: number; status: string; char: string | null; mvp: string; source: string }>(
      `SELECT d.id, d.refine, d.status, c.name AS char, d.mvp, d.source FROM drops d LEFT JOIN characters c ON c.id=d.character_id
       WHERE d.project_id=$1 ORDER BY (d.status='quebrou'), d.refine DESC, d.id`, [id]),
    q<{ id: number; qty: number; char: string | null; mvp: string; status: string; source: string }>(
      `SELECT d.id, d.qty, c.name AS char, d.mvp, d.status, d.source FROM drops d LEFT JOIN characters c ON c.id=d.character_id
       WHERE d.item_id=$1 AND d.status IN ('guardando','loja') ORDER BY d.dropped_on`, [p.item_id]),
    q<{ item_id: number; price: number | null }>("SELECT item_id, price::float8 AS price FROM prices WHERE item_id = ANY($1::int[])", [[t.ore.id, p.item_id]]),
  ]);
  const price = new Map(priceRows.map((r) => [r.item_id, r.price]));
  const orePrice = price.get(t.ore.id) ?? null;
  const itemPrice = price.get(p.item_id) ?? null;

  const alive = units.filter((u) => u.status === "projeto");
  const broken = units.length - alive.length;
  const odds = projectOdds(p.item_type, alive.map((u) => u.refine), p.target_refine);
  const each = chanceOne(p.item_type, 0, p.target_refine);
  const avgItems = each > 0 ? 1 / each : Infinity;
  const itemsFor = (target: number) => (each >= 1 ? 1 : Math.ceil(Math.log(1 - target) / Math.log(1 - each)));
  const oreCost = (orePrice ?? 0) + t.fee;
  const missingToGoal = Math.max(0, p.target_qty - alive.length);

  return (
    <>
      <p><Link href="/projetos" className="dim">← Projetos</Link></p>
      <h1>{p.name} {p.status === "concluido" && <span className="pill">concluído</span>}</h1>
      <p className="sub">{p.item_name} #{p.item_id} · {t.label} · usa {t.ore.name} · taxa de {n(t.fee)} z por tentativa</p>

      <div className="panel" style={{ margin: "16px 0 10px" }}>
        <div className="k dim" style={{ fontSize: 13 }}>Progresso até a média do site para +{p.target_refine}</div>
        <div className="num" style={{ fontSize: 30, fontWeight: 700, marginTop: 2 }}>
          {alive.length} <span className="dim" style={{ fontSize: 18 }}>de {avgItems === Infinity ? "—" : avgItems.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} itens</span>
          <span style={{ color: "var(--accent)", marginLeft: 12 }}>{avgItems === Infinity ? "" : Math.round(Math.min(1, alive.length / avgItems) * 100) + "%"}</span>
        </div>
        <div style={{ height: 10, background: "var(--panel-2)", borderRadius: 6, overflow: "hidden", marginTop: 8 }}>
          <div style={{ width: `${avgItems === Infinity ? 0 : Math.min(100, (alive.length / avgItems) * 100)}%`, height: "100%", background: "var(--accent)" }} />
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          {alive.length >= avgItems ? "Você já juntou a média de itens. Hora de tentar a sorte!" : `Faltam ${Math.ceil(avgItems - alive.length)} para chegar na média.`}
          {broken > 0 && ` · ${broken} já quebrado(s).`}
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="k">Sua meta</div><div className="v num">{alive.length} <span className="dim" style={{ fontSize: 16 }}>/ {p.target_qty}</span></div></div>
        <div className="stat"><div className="k">{t.ore.name} em média para +{p.target_refine}</div><div className="v num">{n(attemptsOne(p.item_type, 0, p.target_refine) / (each || 1))}</div>{orePrice != null && <div className="note">≈ {nk((attemptsOne(p.item_type, 0, p.target_refine) / (each || 1)) * oreCost)} z com a taxa</div>}</div>
        <div className="stat"><div className="k">Chance real com o que tem</div><div className="v num" style={{ fontSize: 20 }}>{odds.done ? "100%" : pct(odds.chance)}</div><div className="note">pelo menos 1 chegar em +{p.target_refine}</div></div>
      </div>

      <h2>Itens do projeto</h2>
      {units.length === 0 ? <p className="note">Nenhum item ainda. Adicione do estoque abaixo ou importe do histórico na página <Link href="/drops">Drops</Link>.</p> : (
        <div className="tbl">
          <table>
            <thead><tr><th>Origem</th><th>Refino atual</th><th>Situação</th><th></th></tr></thead>
            <tbody>{units.map((u) => <UnitRow key={`${u.id}-${u.refine}-${u.status}`} u={u} target={p.target_refine} />)}</tbody>
          </table>
        </div>
      )}
      <p className="note">Quando for refinar, ajuste o "Refino atual" de cada item conforme sobe. Se quebrar, clique em Quebrou. A chance é recalculada na hora.</p>

      <h2>Adicionar do estoque</h2>
      <AddFromStock projectId={p.id} stock={stock} />

      <h2>Tabela de refino ({t.label})</h2>
      <div className="tbl">
        <table>
          <thead><tr><th>Nível</th><th className="r">Chance</th><th className="r">Chance acumulada (+0 → nível)</th><th className="r">Itens em média</th><th className="r">{t.ore.name} em média</th><th className="r">Custo médio total</th></tr></thead>
          <tbody>
            {t.rates.map((r, k) => {
              const lvl = k + 1;
              const acc = chanceOne(p.item_type, 0, lvl);
              const items = 1 / acc;
              const ores = attemptsOne(p.item_type, 0, lvl) / acc;
              const cost = ores * oreCost + items * (itemPrice ?? 0);
              return (
                <tr key={lvl} style={lvl === p.target_refine ? { background: "rgba(242,181,68,.12)" } : undefined}>
                  <td><b>+{lvl}</b></td>
                  <td className="r num">{Math.round(r * 100)}%</td>
                  <td className="r num">{pct(acc)}</td>
                  <td className="r num">{items.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                  <td className="r num">{n(ores)}</td>
                  <td className="r num">{orePrice != null ? nk(cost) + " z" : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note">Mesma conta da Refine Calculator do Payon Stories. Custo total = minérios × ({orePrice != null ? n(orePrice) : "?"} z + taxa de {n(t.fee)} z) + itens × {itemPrice != null ? n(itemPrice) : "?"} z, pelos preços da Price Check.</p>

      <div className="row" style={{ marginTop: 24 }}>
        <form action={setProjectStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value={p.status === "concluido" ? "juntando" : "concluido"} />
          <button className="btn ghost">{p.status === "concluido" ? "Reabrir projeto" : "Marcar como concluído"}</button></form>
        <form action={setProjectStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="apagar" />
          <button className="btn ghost">Apagar projeto</button></form>
      </div>
      <p className="note">Apagar o projeto devolve os itens que não quebraram para "Guardando".</p>
    </>
  );
}
