import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { q } from "@/lib/db";
import { getWeeks, totalsByMvp, fmtDate } from "@/lib/data";
import { refreshPrices } from "@/lib/ps";
import { STATIC_PRICES } from "@/lib/static-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const n = (x: number) => Math.round(x).toLocaleString("pt-BR");
const MIN_KILLS = 10;

async function forceRefresh(form: FormData) {
  "use server";
  const desde = String(form.get("desde") ?? "");
  const items = await q<{ id: number; name: string }>("SELECT DISTINCT item_id AS id, item_name AS name FROM drops");
  await refreshPrices(items, true);
  revalidatePath("/rentabilidade");
  redirect(`/rentabilidade?atualizado=1${desde ? "&desde=" + desde : ""}`);
}

type DropAgg = { mvp: string; item_id: number; item_name: string; qty: number; units: number; fixed: number };
type PriceRow = { item_id: number; name: string; price: number | null; samples: number; source: string; fetched: string };

export default async function Rentabilidade({ searchParams }: { searchParams: Promise<{ desde?: string; atualizado?: string }> }) {
  const sp = await searchParams;
  const weeks = await getWeeks();
  const last = weeks[0];
  const first = (await q<{ d: string | null }>("SELECT to_char(MIN(dropped_on),'YYYY-MM-DD') AS d FROM drops WHERE source <> 'history'"))[0]?.d ?? null;
  const complete = await q<{ character_id: number; mvp: string }>("SELECT character_id, mvp FROM history_flag WHERE complete");
  const isHist = new Set(complete.map((c) => `${c.character_id}|${c.mvp}`));

  if (!last || (!first && complete.length === 0)) {
    return (
      <>
        <h1>Rentabilidade</h1>
        <p className="sub">Ainda não tem drop registrado. Registre na página <Link href="/drops">Drops</Link> ou preencha os "Drops até hoje" de um personagem.</p>
        <p className="note">Kills sem drop registrado não entram na conta, para o KC antigo não puxar a média para baixo.</p>
      </>
    );
  }

  // Período: da última atualização de KC antes do primeiro drop (ou a escolhida) até a mais recente.
  const defBase = first ? weeks.find((w) => w < first) ?? weeks[weeks.length - 1] : last;
  const base = sp.desde && weeks.includes(sp.desde) ? sp.desde : defBase;

  const LATEST = `SELECT DISTINCT ON (character_id, mvp) character_id, mvp, kills FROM kc WHERE week <= $1::date ORDER BY character_id, mvp, week DESC`;
  const [kcNow, kcBase] = await Promise.all([
    q<{ character_id: number; mvp: string; kills: number }>(LATEST, [last]),
    q<{ character_id: number; mvp: string; kills: number }>(LATEST, [base]),
  ]);
  const baseMap = new Map(kcBase.map((r) => [`${r.character_id}|${r.mvp}`, r.kills]));
  const killsHist = new Map<string, number>(), killsPeriod = new Map<string, number>();
  for (const r of kcNow) {
    const k = `${r.character_id}|${r.mvp}`;
    if (isHist.has(k)) killsHist.set(r.mvp, (killsHist.get(r.mvp) ?? 0) + r.kills);
    else {
      const d = r.kills - (baseMap.get(k) ?? 0);
      if (d > 0 && first) killsPeriod.set(r.mvp, (killsPeriod.get(r.mvp) ?? 0) + d);
    }
  }

  const regs = await q<{ character_id: number | null; mvp: string; item_id: number; item_name: string; qty: number; dropped_on: string; status: string; sold_price: number | null; split: number }>(
    `SELECT character_id, mvp, item_id, item_name, qty, to_char(dropped_on,'YYYY-MM-DD') AS dropped_on, status, sold_price::float8 AS sold_price, split
     FROM drops WHERE dropped_on <= $1::date AND source <> 'history'`, [last]);
  const hist = await q<{ character_id: number; mvp: string; item_id: number; item_name: string; qty: number }>(
    "SELECT h.character_id, h.mvp, h.item_id, h.item_name, h.qty FROM history h JOIN history_flag f USING (character_id, mvp) WHERE f.complete");
  const agg = new Map<string, DropAgg>();
  // units: unidades avaliadas pelo preço de mercado (já descontada a divisão); fixed: zeny de vendas reais
  const add = (mvp: string, item_id: number, item_name: string, qty: number, units: number, fixed: number) => {
    const k = `${mvp}|${item_id}`;
    const e = agg.get(k) ?? { mvp, item_id, item_name, qty: 0, units: 0, fixed: 0 };
    e.qty += qty; e.units += units; e.fixed += fixed; agg.set(k, e);
  };
  for (const h of hist) add(h.mvp, h.item_id, h.item_name, h.qty, h.qty, 0);
  for (const r of regs) {
    const histPair = r.character_id != null && isHist.has(`${r.character_id}|${r.mvp}`);
    if (!(histPair || (first && r.dropped_on > base))) continue;
    const share = 1 / Math.max(1, r.split);
    if (r.status === "vendido" && r.sold_price != null) add(r.mvp, r.item_id, r.item_name, r.qty, 0, r.sold_price * r.qty * share);
    else add(r.mvp, r.item_id, r.item_name, r.qty, r.qty * share, 0);
  }
  const drops = [...agg.values()];
  const pending = (await q<{ n: number }>("SELECT COALESCE(SUM(qty),0)::int AS n FROM drops WHERE dropped_on > $1::date AND source <> 'history'", [last]))[0].n;

  const items = [...new Map(drops.map((d) => [d.item_id, { id: d.item_id, name: d.item_name }])).values()];
  await refreshPrices(items); // só busca o que estiver sem preço ou com mais de 7 dias
  const prices = await q<PriceRow>(
    `SELECT item_id, name, price::float8 AS price, samples, source, to_char(fetched_at AT TIME ZONE 'America/Chicago','YYYY-MM-DD') AS fetched
     FROM prices WHERE item_id = ANY($1::int[]) ORDER BY name`, [items.map((i) => i.id)]);
  const found = new Set(prices.map((p) => p.item_id));
  for (const it of items) if (!found.has(it.id)) prices.push({ item_id: it.id, name: it.name, price: null, samples: 0, source: "sem preço (falha ao buscar)", fetched: "" });
  const price = new Map(prices.map((p) => [p.item_id, p.price]));

  const byMvp = new Map<string, { value: number; qty: number; best: { name: string; value: number } | null; missing: number }>();
  for (const d of drops) {
    const e = byMvp.get(d.mvp) ?? { value: 0, qty: 0, best: null, missing: 0 };
    const p = price.get(d.item_id);
    const v = d.fixed + (p != null ? p * d.units : 0);
    if (p == null && d.units > 0) e.missing++;
    e.value += v; e.qty += d.qty;
    if (!e.best || v > e.best.value) e.best = { name: d.item_name, value: v };
    byMvp.set(d.mvp, e);
  }
  const mvps = new Set([...byMvp.keys(), ...killsHist.keys(), ...killsPeriod.keys()]);
  const rows = [...mvps].map((m) => {
    const kh = killsHist.get(m) ?? 0, kp = killsPeriod.get(m) ?? 0;
    const kills = kh + kp;
    const e = byMvp.get(m) ?? { value: 0, qty: 0, best: null, missing: 0 };
    return { mvp: m, kills, kh, kp, ...e, perKill: kills > 0 ? e.value / kills : null };
  }).sort((a, b) => (b.perKill ?? -1) - (a.perKill ?? -1) || b.kills - a.kills);

  const totalValue = rows.reduce((a, r) => a + r.value, 0);
  const totalKills = rows.reduce((a, r) => a + Math.max(0, r.kills), 0);
  const top = rows.find((r) => r.perKill != null && r.kills >= MIN_KILLS);

  return (
    <>
      <h1>Rentabilidade</h1>
      <p className="sub">
        {first
          ? <>Kills de {fmtDate(base)} até {fmtDate(last)} e drops registrados nesse período{complete.length > 0 && <>, mais todas as kills e drops dos personagens com histórico completo</>}.</>
          : <>Todas as kills e drops dos personagens com histórico completo.</>}
        Preço de cada item vem da Price Check do Payon Stories.
      </p>
      {sp.atualizado && <p className="flash">Preços atualizados.</p>}

      <div className="stats">
        <div className="stat"><div className="k">Mais rentável (≥{MIN_KILLS} kills)</div><div className="v accent" style={{ fontSize: 20 }}>{top ? top.mvp : "—"}</div>{top && <div className="note num">{n(top.perKill!)} z por kill</div>}</div>
        <div className="stat"><div className="k">Valor dos drops</div><div className="v num">{n(totalValue)} z</div></div>
        <div className="stat"><div className="k">Kills contadas</div><div className="v num">{n(totalKills)}</div></div>
        <div className="stat"><div className="k">Média geral</div><div className="v num">{totalKills ? n(totalValue / totalKills) : "—"} z/kill</div></div>
      </div>

      {first && last === base && <p className="flash err">Ainda não tem atualização de KC depois de {fmtDate(base)}. Atualize o KC dos personagens para as kills entrarem na conta.</p>}
      {pending > 0 && <p className="note">{pending} drop(s) registrados depois de {fmtDate(last)} entram na conta quando você atualizar o KC.</p>}

      <h2>Por MVP</h2>
      <div className="tbl">
        <table>
          <thead><tr><th>MVP</th><th className="r">Kills</th><th className="r">Drops</th><th className="r">Valor total</th><th className="r">Zeny / kill</th><th>Melhor item</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.mvp}>
                <td>{r.mvp}{r.kills > 0 && r.kills < MIN_KILLS && <> <span className="pill" title="Poucas kills: a média ainda pode mudar muito">poucas kills</span></>}</td>
                <td className="r num" title={r.kh ? `${n(r.kh)} do histórico + ${n(r.kp)} do período` : ""}>{n(r.kills)}{r.kh > 0 && <span className="dim" style={{ fontSize: 12 }}> (hist. {n(r.kh)})</span>}</td>
                <td className="r num">{r.qty}</td>
                <td className="r num">{n(r.value)}{r.missing > 0 && <span className="down" title="Item sem preço"> *</span>}</td>
                <td className="r num"><b>{r.perKill != null ? n(r.perKill) : "—"}</b></td>
                <td className="dim">{r.best ? `${r.best.name} (${n(r.best.value)} z)` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">MVP com kills e sem drop registrado aparece com 0 z — isso também conta na média. Itens vendidos entram pelo preço da venda; itens divididos, só a sua parte. * item sem preço encontrado.</p>

      <h2>Preços usados</h2>
      {prices.length === 0 ? <p className="note">Nenhum item no período.</p> : (
        <div className="tbl">
          <table>
            <thead><tr><th>Item</th><th className="r">Preço</th><th className="r">Vendas</th><th>Fonte</th><th>Atualizado</th></tr></thead>
            <tbody>
              {prices.map((p) => (
                <tr key={p.item_id}>
                  <td><a href={`https://tools.payonstories.com/pc?name=${p.item_id}`} target="_blank" rel="noreferrer">{p.name}</a> <span className="dim">#{p.item_id}</span></td>
                  <td className="r num">{p.price != null ? n(p.price) + " z" : "—"}</td>
                  <td className="r num">{p.samples}</td>
                  <td className="dim">{p.source}</td>
                  <td className="dim num">{p.fetched ? fmtDate(p.fetched) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row" style={{ marginTop: 18, justifyContent: "space-between" }}>
        {first ? <form method="get" className="row">
          <label className="f">Contar kills a partir de
            <select name="desde" defaultValue={base}>{weeks.map((w) => <option key={w} value={w}>{fmtDate(w)}</option>)}</select>
          </label>
          <button className="btn ghost">Aplicar</button>
        </form> : <span />}
<span />
      </div>
      <p className="note">Preços puxados da Price Check em {fmtDate(STATIC_PRICES.updated)}: mediana das médias diárias dos últimos 10 dias com venda. Para atualizar, peça ao Claude.</p>
    </>
  );
}
