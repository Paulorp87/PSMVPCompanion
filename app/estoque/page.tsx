import { q } from "@/lib/db";
import { todayChicago, fmtDate } from "@/lib/data";
import { saveStock } from "@/app/actions";
import { STOCK_ITEMS } from "@/lib/stock";

export const dynamic = "force-dynamic";
const n = (x: number) => Math.round(x).toLocaleString("pt-BR");

export default async function Estoque({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const sp = await searchParams;
  const rows = await q<{ item_id: number; week: string; qty: number }>(
    "SELECT item_id, to_char(week,'YYYY-MM-DD') AS week, qty FROM stock ORDER BY week DESC");
  const prices = new Map((await q<{ item_id: number; price: number | null }>(
    "SELECT item_id, price::float8 AS price FROM prices WHERE item_id = ANY($1::int[])", [STOCK_ITEMS.map((i) => i.id)])).map((p) => [p.item_id, p.price]));
  const weeks = [...new Set(rows.map((r) => r.week))];
  const at = (id: number, w: string) => rows.find((r) => r.item_id === id && r.week === w)?.qty;
  const latest = (id: number) => rows.find((r) => r.item_id === id);

  return (
    <>
      <h1>Estoque</h1>
      <p className="sub">Atualize uma vez por semana quantos Elunium e Oridecon você tem. Os projetos usam esse número.</p>
      {sp.ok && <p className="flash">Estoque salvo.</p>}
      {sp.e && <p className="flash err">Data inválida.</p>}

      <div className="stats">
        {STOCK_ITEMS.map((it) => {
          const l = latest(it.id);
          const p = prices.get(it.id);
          return (
            <div key={it.id} className="stat">
              <div className="k">{it.name}{l ? ` (em ${fmtDate(l.week)})` : ""}</div>
              <div className="v num">{l ? n(l.qty) : "—"}</div>
              {l && p != null && <div className="note">≈ {n(l.qty * p)} z a {n(p)} z cada</div>}
            </div>
          );
        })}
      </div>

      <h2>Atualizar</h2>
      <form action={saveStock} className="panel row">
        <label className="f">Data<input type="date" name="week" defaultValue={todayChicago()} /></label>
        {STOCK_ITEMS.map((it) => (
          <label key={it.id} className="f">{it.name}
            <input name={`q${it.id}`} className="kc-in num" inputMode="numeric" placeholder={String(latest(it.id)?.qty ?? 0)} style={{ width: 120 }} />
          </label>
        ))}
        <button className="btn">Salvar estoque</button>
      </form>
      <p className="note">Deixe em branco o que não mudou. Salvar de novo na mesma data corrige o valor.</p>

      {weeks.length > 0 && (
        <>
          <h2>Histórico</h2>
          <div className="tbl">
            <table>
              <thead><tr><th>Data</th>{STOCK_ITEMS.map((it) => <th key={it.id} className="r">{it.name}</th>)}</tr></thead>
              <tbody>
                {weeks.map((w, i) => (
                  <tr key={w}>
                    <td className="num">{fmtDate(w)}</td>
                    {STOCK_ITEMS.map((it) => {
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
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
