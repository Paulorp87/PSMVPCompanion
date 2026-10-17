import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { q } from "@/lib/db";
import { getWeeks, totalsByMvp, fmtDate } from "@/lib/data";
import { refreshPrices, SALES_SAMPLE } from "@/lib/ps";

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

type DropAgg = { mvp: string; item_id: number; item_name: string; qty: number };
type PriceRow = { item_id: number; name: string; price: number | null; samples: number; source: string; fetched: string };

export default async function Rentabilidade({ searchParams }: { searchParams: Promise<{ desde?: string; atualizado?: string }> }) {
  const sp = await searchParams;
  const weeks = await getWeeks();
  const first = (await q<{ d: string | null }>("SELECT to_char(MIN(dropped_on),'YYYY-MM-DD') AS d FROM drops"))[0]?.d;
  const last = weeks[0];

  if (!first || !last) {
    return (
      <>
        <h1>Rentabilidade</h1>
        <p className="sub">Ainda não tem drop registrado. Comece pela página <Link href="/drops">Drops</Link>.</p>
        <p className="note">O cálculo usa só as kills feitas depois que você começou a registrar drops, para o KC antigo (sem drops) não puxar a média para baixo.</p>
      </>
    );
  }

  // Base: última atualização de KC antes do primeiro drop (ou a escolhida).
  const defBase = weeks.find((w) => w < first) ?? weeks[weeks.length - 1];
  const base = sp.desde && weeks.includes(sp.desde) ? sp.desde : defBase;

  const [now, before] = await Promise.all([totalsByMvp(last), totalsByMvp(base)]);
  const drops = await q<DropAgg>(
    `SELECT mvp, item_id, MAX(item_name) AS item_name, SUM(qty)::int AS qty FROM drops
     WHERE dropped_on > $1::date AND dropped_on <= $2::date GROUP BY mvp, item_id`, [base, last]);
  const pending = (await q<{ n: number }>("SELECT COALESCE(SUM(qty),0)::int AS n FROM drops WHERE dropped_on > $1::date", [last]))[0].n;

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
    const v = p != null ? p * d.qty : 0;
    if (p == null) e.missing++;
    e.value += v; e.qty += d.qty;
    if (!e.best || v > e.best.value) e.best = { name: d.item_name, value: v };
    byMvp.set(d.mvp, e);
  }
  const mvps = new Set([...byMvp.keys(), ...[...now.keys()].filter((m) => (now.get(m) ?? 0) > (before.get(m) ?? 0))]);
  const rows = [...mvps].map((m) => {
    const kills = (now.get(m) ?? 0) - (before.get(m) ?? 0);
    const e = byMvp.get(m) ?? { value: 0, qty: 0, best: null, missing: 0 };
    return { mvp: m, kills, ...e, perKill: kills > 0 ? e.value / kills : null };
  }).sort((a, b) => (b.perKill ?? -1) - (a.perKill ?? -1) || b.kills - a.kills);

  const totalValue = rows.reduce((a, r) => a + r.value, 0);
  const totalKills = rows.reduce((a, r) => a + Math.max(0, r.kills), 0);
  const top = rows.find((r) => r.perKill != null && r.kills >= MIN_KILLS);

  return (
    <>
      <h1>Rentabilidade</h1>
      <p className="sub">
        Kills de {fmtDate(base)} até {fmtDate(last)} e drops registrados nesse período.
        Preço de cada item é a média das últimas {SALES_SAMPLE} vendas na Price Check (item +0, sem carta).
      </p>
      {sp.atualizado && <p className="flash">Preços atualizados.</p>}

      <div className="stats">
        <div className="stat"><div className="k">Mais rentável (≥{MIN_KILLS} kills)</div><div className="v accent" style={{ fontSize: 20 }}>{top ? top.mvp : "—"}</div>{top && <div className="note num">{n(top.perKill!)} z por kill</div>}</div>
        <div className="stat"><div className="k">Valor dos drops</div><div className="v num">{n(totalValue)} z</div></div>
        <div className="stat"><div className="k">Kills no período</div><div className="v num">{n(totalKills)}</div></div>
        <div className="stat"><div className="k">Média geral</div><div className="v num">{totalKills ? n(totalValue / totalKills) : "—"} z/kill</div></div>
      </div>

      {last === base && <p className="flash err">Ainda não tem atualização de KC depois de {fmtDate(base)}. Atualize o KC dos personagens para as kills entrarem na conta.</p>}
      {pending > 0 && <p className="note">{pending} drop(s) registrados depois de {fmtDate(last)} entram na conta quando você atualizar o KC.</p>}

      <h2>Por MVP</h2>
      <div className="tbl">
        <table>
          <thead><tr><th>MVP</th><th className="r">Kills</th><th className="r">Drops</th><th className="r">Valor total</th><th className="r">Zeny / kill</th><th>Melhor item</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.mvp}>
                <td>{r.mvp}{r.kills > 0 && r.kills < MIN_KILLS && <> <span className="pill" title="Poucas kills: a média ainda pode mudar muito">poucas kills</span></>}</td>
                <td className="r num">{n(r.kills)}</td>
                <td className="r num">{r.qty}</td>
                <td className="r num">{n(r.value)}{r.missing > 0 && <span className="down" title="Item sem preço"> *</span>}</td>
                <td className="r num"><b>{r.perKill != null ? n(r.perKill) : "—"}</b></td>
                <td className="dim">{r.best ? `${r.best.name} (${n(r.best.value)} z)` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">MVP com kills e sem drop registrado aparece com 0 z — isso também conta na média. * item sem preço encontrado.</p>

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
        <form method="get" className="row">
          <label className="f">Contar kills a partir de
            <select name="desde" defaultValue={base}>{weeks.map((w) => <option key={w} value={w}>{fmtDate(w)}</option>)}</select>
          </label>
          <button className="btn ghost">Aplicar</button>
        </form>
        <form action={forceRefresh}>
          <input type="hidden" name="desde" value={sp.desde ?? ""} />
          <button className="btn ghost">Atualizar preços agora</button>
        </form>
      </div>
      <p className="note">Os preços se atualizam sozinhos quando têm mais de 7 dias.</p>
    </>
  );
}
