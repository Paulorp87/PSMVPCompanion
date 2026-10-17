import { getWeeks, totalsByMvp, fmtDate } from "@/lib/data";

export const dynamic = "force-dynamic";
const n = (x: number) => x.toLocaleString("pt-BR");
const MAX_WEEKS = 8;

export default async function Mvps() {
  const all = await getWeeks(); // mais recente primeiro
  if (!all.length) return <><h1>Total por MVP</h1><p className="sub">Nenhum KC registrado ainda.</p></>;
  const weeks = all.slice(0, MAX_WEEKS + 1).reverse(); // antiga -> recente
  const maps = await Promise.all(weeks.map((w) => totalsByMvp(w)));
  const last = maps[maps.length - 1];
  const names = [...last.keys()].sort((a, b) => (last.get(b)! - last.get(a)!) || a.localeCompare(b));
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  const base = maps[0];
  const diffs = weeks.slice(1).map((w, i) => ({ w, prev: maps[i], cur: maps[i + 1] }));

  return (
    <>
      <h1>Total por MVP</h1>
      <p className="sub">Total até {fmtDate(weeks[weeks.length - 1])}, com quanto cada MVP subiu em cada atualização.</p>
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>MVP</th>
              <th className="r">Total geral</th>
              {diffs.slice().reverse().map((d) => <th key={d.w} className="r">Em {fmtDate(d.w)}</th>)}
              <th className="r">Até {fmtDate(weeks[0])}</th>
            </tr>
          </thead>
          <tbody>
            {names.map((m) => (
              <tr key={m}>
                <td>{m}</td>
                <td className="r num"><b>{n(last.get(m) ?? 0)}</b></td>
                {diffs.slice().reverse().map((d) => {
                  const x = (d.cur.get(m) ?? 0) - (d.prev.get(m) ?? 0);
                  return <td key={d.w} className={`r num ${x > 0 ? "up" : x < 0 ? "down" : "dim"}`}>{x ? (x > 0 ? "+" : "") + n(x) : "—"}</td>;
                })}
                <td className="r num dim">{n(base.get(m) ?? 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="r num">{n(sum(last))}</td>
              {diffs.slice().reverse().map((d) => <td key={d.w} className="r num up">+{n(sum(d.cur) - sum(d.prev))}</td>)}
              <td className="r num">{n(sum(base))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {all.length > MAX_WEEKS + 1 && <p className="note">Mostrando as últimas {MAX_WEEKS} atualizações.</p>}
    </>
  );
}
