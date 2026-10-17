import Link from "next/link";
import { q } from "@/lib/db";
import { mvpInfo, refreshPrices } from "@/lib/ps";
import { getWeeks, totalsByMvp } from "@/lib/data";
import { reloadMvp, setMobIdAction } from "@/app/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const n = (x: number) => Math.round(x).toLocaleString("pt-BR");
const pct = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";

export default async function Mvp({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent((await params).name);
  let info: Awaited<ReturnType<typeof mvpInfo>> | null = null;
  let err = "";
  try { info = await mvpInfo(name); } catch (e) { err = String(e); }
  const drops = info?.drops ?? [];

  const weeks = await getWeeks();
  const kills = weeks[0] ? (await totalsByMvp(weeks[0])).get(name) ?? 0 : 0;
  const mine = await q<{ item_id: number; item_name: string; qty: number }>(
    `SELECT item_id, MAX(item_name) AS item_name, SUM(qty)::int AS qty FROM (
       SELECT item_id, item_name, qty FROM history WHERE mvp=$1
       UNION ALL SELECT item_id, item_name, qty FROM drops WHERE mvp=$1) t GROUP BY item_id`, [name]);
  const mineMap = new Map(mine.map((m) => [m.item_id, m.qty]));

  const ids = [...new Map([...drops.map((d) => [d.id, d.name] as const), ...mine.map((m) => [m.item_id, m.item_name] as const)]).entries()];
  await refreshPrices(ids.map(([id, nm]) => ({ id, name: nm })));
  const prices = new Map((await q<{ item_id: number; price: number | null; source: string }>(
    "SELECT item_id, price::float8 AS price, source FROM prices WHERE item_id = ANY($1::int[])", [ids.map(([id]) => id)])).map((p) => [p.item_id, p]));
  const extra = mine.filter((m) => !drops.some((d) => d.id === m.item_id));
  const ev = drops.reduce((a, d) => a + (d.rate / 10000) * (prices.get(d.id)?.price ?? 0), 0);

  return (
    <>
      <p><Link href="/tabelas" className="dim">← Tabelas de drop</Link></p>
      <h1>{name}</h1>
      <p className="sub">
        {info?.mob_id ? <>Mob #{info.mob_id} no Payon Stories Tools.</> : err ? "Não consegui acessar o Payon Stories Tools agora." : "Não achei este MVP no site — coloque o ID do monstro abaixo."}
        {" "}Você tem <b>{n(kills)}</b> kills registradas.
      </p>

      {drops.length > 0 && (
        <div className="stats">
          <div className="stat"><div className="k">Valor esperado por kill (taxas oficiais)</div><div className="v num accent">{n(ev)} z</div></div>
        </div>
      )}

      <div className="tbl">
        <table>
          <thead><tr><th className="r">ID</th><th>Item</th><th className="r">Taxa oficial</th><th className="r">Preço médio</th><th className="r">Seus drops</th></tr></thead>
          <tbody>
            {drops.map((d, k) => {
              const p = prices.get(d.id);
              return (
                <tr key={k}>
                  <td className="r num"><b>{d.id}</b></td>
                  <td><a href={`https://tools.payonstories.com/pc?name=${d.id}`} target="_blank" rel="noreferrer">{d.name}</a></td>
                  <td className="r num">{pct(d.rate / 100)}</td>
                  <td className="r num">{p?.price != null ? n(p.price) + " z" : "—"}{p?.source === "NPC" && <span className="dim"> (NPC)</span>}</td>
                  <td className="r num">{mineMap.get(d.id) ?? <span className="dim">—</span>}</td>
                </tr>
              );
            })}
            {extra.map((m) => (
              <tr key={"x" + m.item_id}>
                <td className="r num"><b>{m.item_id}</b></td><td>{m.item_name} <span className="pill">fora da tabela</span></td><td className="r dim">—</td>
                <td className="r num">{prices.get(m.item_id)?.price != null ? n(prices.get(m.item_id)!.price!) + " z" : "—"}</td>
                <td className="r num">{m.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">"Seus drops" soma os drops até hoje dos personagens e os drops registrados. O valor esperado usa a taxa oficial × preço médio de cada item.</p>

      <h2>Corrigir ou recarregar</h2>
      <div className="row">
        <form action={setMobIdAction} className="row">
          <input type="hidden" name="name" value={name} />
          <label className="f">ID do monstro<input name="mob_id" inputMode="numeric" defaultValue={info?.mob_id ?? ""} style={{ width: 110 }} /></label>
          <button className="btn ghost">Usar este ID</button>
        </form>
        <form action={reloadMvp}><input type="hidden" name="name" value={name} /><button className="btn ghost">Recarregar tabela do site</button></form>
      </div>
    </>
  );
}
