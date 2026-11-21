"use client";
import { useState, useTransition } from "react";
import { setRefine, breakItem, addToProject, overItem, setOverValue, undoOver } from "@/app/actions";

type Unit = { id: number; refine: number; status: string; char: string | null; mvp: string; source: string;
  over_result: string | null; over_from: number | null; over_base: number | null; over_cost: number | null; over_value: number | null };
type Stock = { id: number; qty: number; char: string | null; mvp: string; status: string; source: string };

const nz = (x: number) => Math.round(x).toLocaleString("pt-BR");

export function UnitRow({ u, target }: { u: Unit; target: number }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reached, setReached] = useState(String(Math.min(10, Math.max(u.refine, target - 1))));
  const [result, setResult] = useState<"quebrou" | "consegui">("quebrou");
  const [value, setValue] = useState("");
  const [val2, setVal2] = useState(u.over_value != null ? String(Math.round(u.over_value)) : "");
  const broken = u.status === "quebrou";
  const won = u.over_result === "consegui";
  const r = Number(reached);
  const invalid = result === "consegui" ? r <= u.refine : r < u.refine;
  const spent = (u.over_base ?? 0) + (u.over_cost ?? 0);

  let situ: React.ReactNode = <span className="dim">No projeto</span>;
  if (broken) situ = <span className="down">Quebrou {u.over_result ? `indo pra +${u.refine + 1}` : `(estava em +${u.refine})`}
    {u.over_result && <div style={{ fontSize: 12 }}>prejuízo −{nz(spent)} z <span className="dim">(item {nz(u.over_base ?? 0)} + refino {nz(u.over_cost ?? 0)})</span></div>}</span>;
  if (won) situ = <span className="up">Conseguiu +{u.refine}
    <div style={{ fontSize: 12 }}>{u.over_value != null ? <>lucro {nz(u.over_value - spent)} z <span className="dim">(vale {nz(u.over_value)} − item {nz(u.over_base ?? 0)} − refino {nz(u.over_cost ?? 0)})</span></>
      : <span className="dim">custo {nz(spent)} z · falta o valor do +{u.refine}</span>}</div></span>;

  return (
    <tr style={{ opacity: broken ? 0.6 : 1 }}>
      <td>{u.char ?? "—"} <span className="dim">· {u.mvp}{u.source === "history" ? " · do histórico" : ""}</span></td>
      <td>
        {u.over_result || broken ? <b>+{u.refine}</b> : (
          <select value={u.refine} disabled={pending} title="Refino seguro / atual" onChange={(e) => start(() => setRefine(u.id, Number(e.target.value)))}>
            {Array.from({ length: 11 }, (_, i) => i).map((n) => <option key={n} value={n}>+{n}</option>)}
          </select>
        )}
        {u.refine >= target && !broken && <span className="up"> ✓</span>}
      </td>
      <td>{situ}
        {won && (
          <div className="row" style={{ gap: 4, marginTop: 4 }}>
            <input className="kc-in num" inputMode="numeric" style={{ width: 120 }} placeholder={`valor do +${u.refine}`} value={val2}
              onChange={(e) => setVal2(e.target.value.replace(/\D/g, ""))} />
            <button className="btn small ghost" disabled={pending} onClick={() => start(() => setOverValue(u.id, Number(val2) || null))}>ok</button>
          </div>
        )}
        {open && !u.over_result && !broken && (
          <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="f" style={{ fontSize: 12 }}>Chegou até
              <select value={reached} onChange={(e) => setReached(e.target.value)}>
                {Array.from({ length: 11 }, (_, i) => i).map((n) => <option key={n} value={n}>+{n}</option>)}
              </select></label>
            <label className="f" style={{ fontSize: 12 }}>Resultado
              <select value={result} onChange={(e) => setResult(e.target.value as "quebrou" | "consegui")}>
                <option value="quebrou">Quebrou</option><option value="consegui">Consegui</option>
              </select></label>
            {result === "consegui" && <label className="f" style={{ fontSize: 12 }}>Valor do +{reached} (opcional)
              <input className="kc-in num" inputMode="numeric" style={{ width: 120 }} value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} /></label>}
            <button className="btn small" disabled={pending || invalid}
              onClick={() => start(async () => { await overItem(u.id, r, result, Number(value) || null); setOpen(false); })}>Salvar</button>
            <button className="btn small ghost" type="button" onClick={() => setOpen(false)}>cancelar</button>
            <div className="dim" style={{ fontSize: 11, width: "100%" }}>
              {result === "quebrou" ? `Subiu de +${u.refine} até +${r} e quebrou tentando o +${r + 1}.` : `Subiu de +${u.refine} até +${r} e parou aí.`}
              {invalid && " Confira o nível."}</div>
          </div>
        )}
      </td>
      <td className="r" style={{ whiteSpace: "nowrap" }}>
        {u.over_result ? <button className="btn ghost small" disabled={pending} onClick={() => start(() => undoOver(u.id))}>Desfazer</button>
          : broken ? <button className="btn ghost small" disabled={pending} onClick={() => start(() => breakItem(u.id, false))}>Desfazer</button>
          : !open && <button className="btn small" disabled={pending} onClick={() => setOpen(true)}>Dei over</button>}
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
              <td className="dim">{s.status === "loja" ? "Indo pra loja" : s.status === "sem_status" ? "Sem status" : "Guardando"}</td>
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
