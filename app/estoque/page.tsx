import { q } from "@/lib/db";
import { todayChicago, fmtDate } from "@/lib/data";
import { saveStock } from "@/app/actions";
import { STOCK_ITEMS, STOCK_GROUPS, HERBS } from "@/lib/stock";
import Potei from "./Potei";

export const dynamic = "force-dynamic";
const n = (x: number) => Math.round(x).toLocaleString("pt-BR");
const pct = (x: number) => (x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";

export default async function Estoque({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const sp = await searchParams;
  const ids = STOCK_ITEMS.map((i) => i.id);
  const [rows, priceRows, brews] = await Promise.all([
    q<{ item_id: number; week: string; qty: number }>(
      "SELECT item_id, to_char(week,'YYYY-MM-DD') AS week, qty FROM stock WHERE item_id = ANY($1::int[]) ORDER BY week DESC", [ids]),
    q<{ item_id: number; price: number | null; source: string | null }>(
      "SELECT item_id, price::float8 AS price, source FROM prices WHERE item_id = ANY($1::int[])", [ids]),
    q<{ herb_id: number; used: number; pots: number; n: number }>(
      "SELECT herb_id, SUM(used)::int AS used, SUM(potions)::int AS pots, COUNT(*)::int AS n FROM herb_brews GROUP BY herb_id"),
  ]);
  const prices = new Map(priceRows.map((p) => [p.item_id, p.price]));
  const at = (id: number, w: string) => rows.find((r) => r.item_id === id && r.week === w)?.qty;
  const latest = (id: number) => rows.find((r) => r.item_id === id);
  const value = (id: number) => { const l = latest(id), p = prices.get(id); return l && p != null ? l.qty * p : null; };
  const groupValue = (items: { id: number }[]) => items.reduce((a, it) => a + (value(it.id) ?? 0), 0);

  return (
    <>
      <h1>Estoque</h1>
      <p className="sub">Atualize quando quiser quantos você tem de cada. O valor usa o preço médio da Price Check do Payon Stories. Os projetos usam o Elunium e o Oridecon daqui.</p>
      {sp.ok && <p className="flash">Estoque salvo.</p>}
      {sp.e && <p className="flash err">Data inválida.</p>}

      {STOCK_GROUPS.map((g) => (
        <div key={g.title}>
          <h2>{g.title} <span className="dim" style={{ fontSize: 14, fontWeight: 400 }}>≈ {n(groupValue(g.items))} z</span></h2>
          <div className="tbl"><table>
            <thead><tr><th>Item</th><th className="r">Qtd</th><th className="r">Preço</th><th className="r">Valor</th>
              {g.title === "Ervas" && <><th className="r">Conversão</th><th></th></>}</tr></thead>
            <tbody>{g.items.map((it) => {
              const l = latest(it.id), p = prices.get(it.id), v = value(it.id);
              const herb = HERBS.find((h) => h.id === it.id);
              const b = herb ? brews.find((x) => x.herb_id === herb.id) : null;
              return (
                <tr key={it.id}>
                  <td>{it.name}{l && <div className="dim" style={{ fontSize: 11 }}>atualizado em {fmtDate(l.week)}</div>}</td>
                  <td className="r num">{l ? n(l.qty) : "—"}</td>
                  <td className="r num">{p != null ? n(p) : <span className="dim">sem preço</span>}</td>
                  <td className="r num">{v != null ? n(v) : "—"}</td>
                  {herb && <>
                    <td className="r num">{b && b.used ? <>{pct(b.pots / b.used)}<div className="dim" style={{ fontSize: 11 }}>{n(b.pots)} de {n(b.used)}</div></> : <span className="dim">—</span>}</td>
                    <td><Potei herbId={herb.id} potion={herb.potion.name} max={l?.qty ?? 0} /></td>
                  </>}
                </tr>
              );
            })}</tbody>
          </table></div>
        </div>
      ))}
      <p className="note">Potei: escolha na erva, coloque quantas usou e quantas poções saíram. As ervas saem do estoque, as poções entram, e a % de conversão fica guardada.</p>

      <h2>Atualizar</h2>
      <form action={saveStock} className="panel">
        <label className="f" style={{ marginBottom: 8 }}>Data<input type="date" name="week" defaultValue={todayChicago()} /></label>
        {STOCK_GROUPS.map((g) => (
          <div key={g.title} className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            {g.items.map((it) => (
              <label key={it.id} className="f">{it.name}
                <input name={`q${it.id}`} className="kc-in num" inputMode="numeric" placeholder={String(latest(it.id)?.qty ?? 0)} style={{ width: 110 }} />
              </label>
            ))}
          </div>
        ))}
        <button className="btn">Salvar estoque</button>
      </form>
      <p className="note">Deixe em branco o que não mudou. Salvar de novo na mesma data corrige o valor.</p>

      {STOCK_GROUPS.map((g) => {
        const weeks = [...new Set(rows.filter((r) => g.items.some((it) => it.id === r.item_id)).map((r) => r.week))];
        if (!weeks.length) return null;
        return (
          <div key={g.title}>
            <h2>Histórico · {g.title}</h2>
            <div className="tbl"><table>
              <thead><tr><th>Data</th>{g.items.map((it) => <th key={it.id} className="r">{it.name}</th>)}</tr></thead>
              <tbody>{weeks.map((w, i) => (
                <tr key={w}>
                  <td className="num">{fmtDate(w)}</td>
                  {g.items.map((it) => {
                    const v = at(it.id, w);
                    const prevW = weeks.slice(i + 1).find((x) => at(it.id, x) !== undefined);
                    const pv = prevW ? at(it.id, prevW) : undefined;
                    const d = v !== undefined && pv !== undefined ? v - pv : null;
                    return (
                      <td key={it.id} className="r num">
                        {v !== undefined ? n(v) : <span className="dim">—</span>}
                        {d !== null && d !== 0 && <span className={d > 0 ? "up" : "down"} style={{ fontSize: 12 }}> {d > 0 ? "+" : ""}{n(d)}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        );
      })}
    </>
  );
}
