"use client";
import { useTransition } from "react";
import { setRefine, breakItem, addToProject } from "@/app/actions";

type Unit = { id: number; refine: number; status: string; char: string | null; mvp: string; source: string };
type Stock = { id: number; qty: number; char: string | null; mvp: string; status: string; source: string };

export function UnitRow({ u, target }: { u: Unit; target: number }) {
  const [pending, start] = useTransition();
  const broken = u.status === "quebrou";
  return (
    <tr style={{ opacity: broken ? 0.55 : 1 }}>
      <td>{u.char ?? "—"} <span className="dim">· {u.mvp}{u.source === "history" ? " · do histórico" : ""}</span></td>
      <td>
        <select value={u.refine} disabled={pending || broken} onChange={(e) => start(() => setRefine(u.id, Number(e.target.value)))}>
          {Array.from({ length: 11 }, (_, i) => i).map((n) => <option key={n} value={n}>+{n}</option>)}
        </select>
        {u.refine >= target && !broken && <span className="up"> ✓ chegou!</span>}
      </td>
      <td className={broken ? "down" : "dim"}>{broken ? `Quebrou (estava em +${u.refine})` : "No projeto"}</td>
      <td className="r">
        <button className="btn ghost small" disabled={pending} onClick={() => start(() => breakItem(u.id, !broken))}>
          {broken ? "Desfazer" : "Quebrou"}
        </button>
      </td>
    </tr>
  );
}

export function AddFromStock({ projectId, stock }: { projectId: number; stock: Stock[] }) {
  const [pending, start] = useTransition();
  if (!stock.length) return <p className="note">Nenhum item deste tipo guardado no estoque.</p>;
  return (
    <div className="tbl">
      <table>
        <thead><tr><th>Origem</th><th>Status</th><th className="r">Qtd</th><th></th></tr></thead>
        <tbody>
          {stock.map((s) => (
            <tr key={s.id}>
              <td>{s.char ?? "—"} <span className="dim">· {s.mvp}{s.source === "history" ? " · do histórico" : ""}</span></td>
              <td className="dim">{s.status === "loja" ? "Indo pra loja" : "Guardando"}</td>
              <td className="r num">{s.qty}</td>
              <td className="r" style={{ whiteSpace: "nowrap" }}>
                <form style={{ display: "inline-flex", gap: 6 }} onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number((e.currentTarget.elements.namedItem("n") as HTMLInputElement).value);
                  start(() => addToProject(projectId, s.id, Math.max(1, Math.min(n, s.qty))));
                }}>
                  <input name="n" className="kc-in num" defaultValue={s.qty} style={{ width: 60 }} inputMode="numeric" />
                  <button className="btn small" disabled={pending}>Pôr no projeto</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
