"use client";
import { useState, useTransition } from "react";
import { updateDrop, useItem, setOver } from "@/app/actions";
import { TAMING } from "@/lib/taming";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/status";

export type DropRowData = {
  id: number; dropped_on: string; mvp: string; item_id: number; item_name: string; qty: number; char: string | null;
  status: Status; sold_price: number | null; split: number; project_id: number | null; source: string; refine: number; capture: string | null;
};
type Proj = { id: number; name: string; item_id: number };

const fmt = (iso: string) => iso.split("-").reverse().join("/");

export default function DropRow({ d, projects, onDelete }: { d: DropRowData; projects: Proj[]; onDelete: React.ReactNode }) {
  const [status, setStatus] = useState<Status | "over">(d.status);
  const [over, setOverLvl] = useState(String(Math.min(10, d.refine + 1)));
  const [qty, setQty] = useState(String(d.qty));
  const [price, setPrice] = useState(d.sold_price != null ? String(d.sold_price) : "");
  const [split, setSplit] = useState(String(d.split));
  const [proj, setProj] = useState(d.project_id ? String(d.project_id) : "");
  const [caught, setCaught] = useState("0");
  const [pending, start] = useTransition();
  const tame = TAMING[d.item_id];
  const mine = projects.filter((p) => p.item_id === d.item_id);
  const dirty = status !== d.status || Number(qty) !== d.qty || (price || "") !== (d.sold_price != null ? String(d.sold_price) : "")
    || Number(split) !== d.split || (proj || "") !== (d.project_id ? String(d.project_id) : "");

  function save() {
    if (status === "over") {
      start(async () => { await setOver(d.id, Number(qty) || d.qty, Number(over)); });
      return;
    }
    if (status === "usado") {
      start(async () => { await useItem(d.id, Number(qty) || d.qty, Number(caught) || 0); });
      return;
    }
    start(async () => {
      await updateDrop(d.id, {
        status,
        qty: Number(qty) < d.qty ? Number(qty) : undefined,
        sold_price: status === "vendido" ? (price ? Number(price) : null) : undefined,
        split: Number(split) || 1,
        project_id: status === "projeto" ? (proj ? Number(proj) : null) : null,
      });
    });
  }

  return (
    <tr>
      <td className="num">{fmt(d.dropped_on)}</td>
      <td>{d.mvp}<div className="dim" style={{ fontSize: 12 }}>{d.char ?? "—"}{d.source === "history" && " · do histórico"}</div></td>
      <td>{d.refine > 0 && <b>+{d.refine} </b>}{d.item_name} <span className="dim">#{d.item_id}</span></td>
      <td className="r">
        {d.qty > 1 && d.status !== "usado"
          ? <input className="kc-in num" style={{ width: 64 }} inputMode="numeric" value={qty} title={`Aplicar a quantos dos ${d.qty}`}
              onChange={(e) => setQty(e.target.value.replace(/\D/g, "") || "1")} />
          : <span className="num">{d.qty}</span>}
        {d.qty > 1 && d.status !== "usado" && <div className="dim" style={{ fontSize: 11 }}>de {d.qty}</div>}
      </td>
      <td>
        {d.status === "usado" ? (
          <span className={d.capture === "sucesso" ? "up" : d.capture === "falha" ? "down" : "dim"}>
            Usei{d.capture === "sucesso" ? ` · capturou ${tame?.pet ?? ""} ✓` : d.capture === "falha" ? " · falhou" : ""}
          </span>
        ) : <>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status | "over")}>
          {STATUSES.filter((s) => s !== "projeto" || mine.length > 0 || status === "projeto").map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          <option value="over">Dei over…</option>
        </select>
        {status === "over" && (
          <select value={over} onChange={(e) => setOverLvl(e.target.value)} style={{ marginTop: 4, display: "block" }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>+{n}</option>)}
          </select>
        )}
        {status === "projeto" && (
          <select value={proj} onChange={(e) => setProj(e.target.value)} style={{ marginTop: 4, display: "block" }}>
            <option value="">Escolha o projeto</option>
            {mine.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {status === "vendido" && (
          <input placeholder="Preço por unidade" inputMode="numeric" value={price} style={{ marginTop: 4, display: "block", width: 150 }}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
        )}
        {status === "usado" && tame && (
          Number(qty) <= 1 ? (
            <div className="row" style={{ marginTop: 4, gap: 4 }}>
              <button type="button" className={`btn small ${caught === "1" ? "" : "ghost"}`} onClick={() => setCaught("1")}>Capturou {tame.pet}</button>
              <button type="button" className={`btn small ${caught === "0" ? "" : "ghost"}`} onClick={() => setCaught("0")}>Falhou</button>
            </div>
          ) : (
            <label className="f" style={{ marginTop: 4 }}>Capturou quantos {tame.pet}?
              <input className="kc-in num" inputMode="numeric" value={caught} style={{ width: 70 }}
                onChange={(e) => setCaught(String(Math.min(Number(e.target.value.replace(/\D/g, "") || 0), Number(qty) || d.qty)))} />
            </label>
          )
        )}
        </>}
      </td>
      <td className="r">
        <input className="kc-in num" style={{ width: 52 }} inputMode="numeric" value={split} title="Dividido entre quantas pessoas"
          onChange={(e) => setSplit(e.target.value.replace(/\D/g, "") || "1")} />
      </td>
      <td className="r" style={{ whiteSpace: "nowrap" }}>
        {d.status !== "usado" && <button className="btn small" disabled={!dirty || pending || (status === "projeto" && !proj)} onClick={save}>{pending ? "…" : "Salvar"}</button>}{" "}
        {onDelete}
      </td>
    </tr>
  );
}
