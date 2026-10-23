import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { q } from "@/lib/db";
import { getWeeks, totalsByMvp, fmtDate } from "@/lib/data";
import { refreshPrices } from "@/lib/ps";
import { STATIC_PRICES } from "@/lib/static-data";
import { STOCK_IDS } from "@/lib/stock";

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
  const first = (await q<{ d: string | null }>("SELECT to_char(MIN(dropped_on),'YYYY-MM-DD') AS d FROM drops WHERE source = 'drop'"))[0]?.d ?? null;
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

  const regs = await q<{ character_id: number | null; mvp: string; item_id: number; item_name: string; qty: number; dropped_on: string; status: string; sold_price: number | null; split: number; support: boolean }>(
    `SELECT character_id, mvp, item_id, item_name, qty, to_char(dropped_on,'YYYY-MM-DD') AS dropped_on, status, sold_price::float8 AS sold_price, split, support
     FROM drops WHERE dropped_on <= $1::date AND source = 'drop'`, [last]);
  const hist = await q<{ character_id: number; mvp: string; item_id: number; item_name: string; qty: number }>(
    "SELECT h.character_id, h.mvp, h.item_id, h.item_name, h.qty FROM history h JOIN history_flag f USING (character_id, mvp) WHERE f.complete");
  type Kind = "solo" | "sup";
  const agg = { solo: new Map<string, DropAgg>(), sup: new Map<string, DropAgg>() };
  // units: unidades avaliadas pelo preço de mercado (já descontada a divisão); fixed: zeny de vendas reais
  const add = (kind: Kind, mvp: string, item_id: number, item_name: string, qty: number, units: number, fixed: number) => {
    if (STOCK_IDS.includes(item_id)) return; // Elunium/Oridecon ficam fora (controlados pelo Estoque)
    const k = `${mvp}|${item_id}`;
    const e = agg[kind].get(k) ?? { mvp, item_id, item_name, qty: 0, units: 0, fixed: 0 };
    e.qty += qty; e.units += units; e.fixed += fixed; agg[kind].set(k, e);
  };
  // itens importados do histórico e vendidos: entram pelo preço da venda (no lugar do preço médio)
  const soldHist = await q<{ character_id: number; mvp: string; item_id: number; qty: number; sold_price: number; split: number }>(
    `SELECT character_id, mvp, item_id, qty, sold_price::float8 AS sold_price, split FROM drops
     WHERE source='history' AND status='vendido' AND sold_price IS NOT NULL`);
  for (const h of hist) {
    const sold = soldHist.filter((x) => x.character_id === h.character_id && x.mvp === h.mvp && x.item_id === h.item_id);
    const soldQty = Math.min(h.qty, sold.reduce((a, x) => a + x.qty, 0));
    const soldValue = sold.reduce((a, x) => a + (x.sold_price * x.qty) / Math.max(1, x.split), 0);
    add("solo", h.mvp, h.item_id, h.item_name, h.qty, h.qty - soldQty, soldQty > 0 ? soldValue : 0);
  }
  for (const r of regs) {
    const inPeriod = !!first && r.dropped_on > base;
    if (r.support) { if (!inPeriod) continue; }
    else {
      const histPair = r.character_id != null && isHist.has(`${r.character_id}|${r.mvp}`);
      if (!(histPair || inPeriod)) continue;
    }
    const kind: Kind = r.support ? "sup" : "solo";
    const share = 1 / Math.max(1, r.split);
    if (r.status === "vendido" && r.sold_price != null) add(kind, r.mvp, r.item_id, r.item_name, r.qty, 0, r.sold_price * r.qty * share);
    else add(kind, r.mvp, r.item_id, r.item_name, r.qty, r.qty * share, 0);
  }
  // participações como suporte no mesmo período
  const sups = await q<{ mvp: string; n: number }>(
    "SELECT mvp, count(*)::int AS n FROM support WHERE day > $1::date AND day <= $2::date GROUP BY mvp", [base, last]);
  const parts = new Map(sups.map((x) => [x.mvp, x.n]));
  const pending = (await q<{ n: number }>("SELECT COALESCE(SUM(qty),0)::int AS n FROM drops WHERE dropped_on > $1::date AND source = 'drop'", [last]))[0].n;
  const pendingSup = (await q<{ n: number }>("SELECT count(*)::int AS n FROM support WHERE day > $1::date", [last]))[0].n;

  const allDrops = [...agg.solo.values(), ...agg.sup.values()];
  const items = [...new Map(allDrops.map((d) => [d.item_id, { id: d.item_id, name: d.item_name }])).values()];
  await refreshPrices(items); // só busca o que estiver sem preço ou com mais de 7 dias
  const prices = await q<PriceRow>(
    `SELECT item_id, name, price::float8 AS price, samples, source, to_char(fetched_at AT TIME ZONE 'America/Chicago','YYYY-MM-DD') AS fetched
     FROM prices WHERE item_id = ANY($1::int[]) ORDER BY name`, [items.map((i) => i.id)]);
  const found = new Set(prices.map((p) => p.item_id));
  for (const it of items) if (!found.has(it.id)) prices.push({ item_id: it.id, name: it.name, price: null, samples: 0, source: "sem preço (falha ao buscar)", fetched: "" });
  const price = new Map(prices.map((p) => [p.item_id, p.price]));

  type Acc = { value: number; qty: number; best: { name: string; value: number } | null; missing: number };
  const sum = (m: Map<string, DropAgg>) => {
    const by = new Map<string, Acc>();
    for (const d of m.values()) {
      const e = by.get(d.mvp) ?? { value: 0, qty: 0, best: null, missing: 0 };
      const p = price.get(d.item_id);
      const v = d.fixed + (p != null ? p * d.units : 0);
      if (p == null && d.units > 0) e.missing++;
      e.value += v; e.qty += d.qty;
      if (!e.best || v > e.best.value) e.best = { name: d.item_name, value: v };
      by.set(d.mvp, e);
    }
    return by;
  };
  const solo = sum(agg.solo), sup = sum(agg.sup);
  const empty: Acc = { value: 0, qty: 0, best: null, missing: 0 };
  const mvps = new Set([...solo.keys(), ...sup.keys(), ...killsHist.keys(), ...killsPeriod.keys(), ...parts.keys()]);
  const rows = [...mvps].map((m) => {
    const kh = killsHist.get(m) ?? 0, kp = killsPeriod.get(m) ?? 0;
    const kills = kh + kp, part = parts.get(m) ?? 0;
    const so = solo.get(m) ?? empty, su = sup.get(m) ?? empty;
    const value = so.value + su.value, all = kills + part;
    const best = [so.best, su.best].filter(Boolean).sort((a, b) => b!.value - a!.value)[0] ?? null;
    return {
      mvp: m, kills, kh, kp, part, value, all, best, missing: so.missing + su.missing, qty: so.qty + su.qty,
      soloValue: so.value, supValue: su.value,
      perKill: all > 0 ? value / all : null,
      soloPer: kills > 0 ? so.value / kills : null,
      supPer: part > 0 ? su.value / part : null,
    };
  }).sort((a, b) => (b.perKill ?? -1) - (a.perKill ?? -1) || b.all - a.all);

  const tot = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + Math.max(0, f(r)), 0);
  const totalValue = tot((r) => r.value), totalAll = tot((r) => r.all);
  const soloValue = tot((r) => r.soloValue), soloKills = tot((r) => r.kills);
  const supValue = tot((r) => r.supValue), supParts = tot((r) => r.part);
  const top = rows.find((r) => r.perKill != null && r.all >= MIN_KILLS);

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
        <div className="stat"><div className="k">Mais rentável (≥{MIN_KILLS} kills, total)</div><div className="v accent" style={{ fontSize: 20 }}>{top ? top.mvp : "—"}</div>{top && <div className="note num">{n(top.perKill!)} z por kill</div>}</div>
        <div className="stat"><div className="k">Total</div><div className="v num">{totalAll ? n(totalValue / totalAll) : "—"} z/kill</div><div className="note num">{n(totalValue)} z em {n(totalAll)} kills</div></div>
        <div className="stat"><div className="k">Solo (kills próprias)</div><div className="v num">{soloKills ? n(soloValue / soloKills) : "—"} z/kill</div><div className="note num">{n(soloValue)} z em {n(soloKills)} kills</div></div>
        <div className="stat"><div className="k">Suporte</div><div className="v num">{supParts ? n(supValue / supParts) : "—"} z/part.</div><div className="note num">{n(supValue)} z em {n(supParts)} participações</div></div>
      </div>

      {first && last === base && <p className="flash err">Ainda não tem atualização de KC depois de {fmtDate(base)}. Atualize o KC dos personagens para as kills entrarem na conta.</p>}
      {(pending > 0 || pendingSup > 0) && <p className="note">{pending > 0 && `${pending} drop(s)`}{pending > 0 && pendingSup > 0 && " e "}{pendingSup > 0 && `${pendingSup} participação(ões) como suporte`} depois de {fmtDate(last)} entram na conta quando você atualizar o KC.</p>}

      <h2>Por MVP</h2>
      <div className="tbl">
        <table>
          <thead>
            <tr><th></th><th colSpan={2} className="r" style={{ borderBottom: 0 }}>Solo</th><th colSpan={2} className="r" style={{ borderBottom: 0 }}>Suporte</th><th colSpan={3} className="r" style={{ borderBottom: 0 }}>Total</th><th></th></tr>
            <tr><th>MVP</th><th className="r">Kills</th><th className="r">z / kill</th><th className="r">Part.</th><th className="r">z / part.</th><th className="r">Valor</th><th className="r">Kills + part.</th><th className="r">z / kill</th><th>Melhor item</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.mvp}>
                <td>{r.mvp}{r.all > 0 && r.all < MIN_KILLS && <> <span className="pill" title="Poucas kills: a média ainda pode mudar muito">poucas kills</span></>}</td>
                <td className="r num" title={r.kh ? `${n(r.kh)} do histórico + ${n(r.kp)} do período` : ""}>{n(r.kills)}{r.kh > 0 && <span className="dim" style={{ fontSize: 12 }}> (hist.)</span>}</td>
                <td className="r num">{r.soloPer != null ? n(r.soloPer) : "—"}</td>
                <td className="r num">{r.part || "—"}</td>
                <td className="r num">{r.supPer != null ? n(r.supPer) : "—"}</td>
                <td className="r num">{n(r.value)}{r.missing > 0 && <span className="down" title="Item sem preço"> *</span>}</td>
                <td className="r num">{n(r.all)}</td>
                <td className="r num"><b>{r.perKill != null ? n(r.perKill) : "—"}</b></td>
                <td className="dim">{r.best ? `${r.best.name} (${n(r.best.value)} z)` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">MVP com kills e sem drop registrado aparece com 0 z — isso também conta na média. Solo usa os drops das suas kills; Suporte, os drops marcados como de suporte divididos pelas participações; Total junta os dois. Itens vendidos entram pelo preço da venda; itens divididos, só a sua parte. Elunium e Oridecon ficam fora (são controlados pelo Estoque). * item sem preço encontrado.</p>

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
