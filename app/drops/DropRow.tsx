"use client";
import { useState, useTransition } from "react";
import { updateDrop, useItem, setOver, openBox } from "@/app/actions";
import { BOXES } from "@/lib/boxes";
import { TAMING } from "@/lib/taming";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/status";

export type DropRowData = {
  id: number; dropped_on: string; mvp: string; item_id: number; item_name: string; qty: number; char: string | null;
  status: Status; sold_price: number | null; split: number; project_id: number | null; source: string; refine: number; capture: string | null; opened_name?: string | null;
};
type Proj = { id: number; name: string; item_id: number };

const fmt = (iso: string) => iso.split("-").reverse().join("/");
const kz = (n: number) => n >= 1e6 ? `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);
const norm = (t: string) => t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function DropRow({ d, projects, onDelete }: { d: DropRowData; projects: Proj[]; onDelete: React.ReactNode }) {
  const [status, setStatus] = useState<Status | "over" | "abrir">(d.status);
  const [find, setFind] = useState("");
  const [card, setCard] = useState<number | null>(null);
  const [over, setOverLvl] = useState(String(Math.min(10, d.refine + 1)));
  const [qty, setQty] = useState(String(d.qty));
  const [price, setPrice] = useState(d.sold_price != null ? String(d.sold_price) : "");
  const [split, setSplit] = useState(String(d.split));
  const [proj, setProj] = useState(d.project_id ? String(d.project_id) : "");
  const [caught, setCaught] = useState("0");
  const [pending, start] = useTransition();
  const tame = TAMING[d.item_id];
  const box = BOXES[d.item_id];
  const hits = box && find.trim().length >= 2
    ? box.items.filter((c) => norm(c.name).includes(norm(find.trim())) || String(c.id).startsWith(find.trim())).slice(0, 8) : [];
  const picked = box?.items.find((c) => c.id === card);
  const mine = projects.filter((p) => p.item_id === d.item_id);
  const dirty = status !== d.status || Number(qty) !== d.qty || (price || "") !== (d.sold_price != null ? String(d.sold_price) : "")
    || Number(split) !== d.split || (proj || "") !== (d.project_id ? String(d.project_id) : "");

  function save() {
    if (status === "abrir") {
      if (!card) return;
      start(async () => { await openBox(d.id, card); setCard(null); setFind(""); setStatus(d.qty > 1 ? d.status : "usado"); });
      return;
    }
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
      <td>{d.mvp}<div className="dim" style={{ fontSize: 12 }}>{d.char ?? "—"}{d.source === "history" && " · do histórico"}{d.source === "caixa" && " · saiu da caixa"}</div></td>
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
            {d.opened_name ? <>Abri · saiu <b>{d.opened_name}</b></> : <>Usei{d.capture === "sucesso" ? ` · capturou ${tame?.pet ?? ""} ✓` : d.capture === "falha" ? " · falhou" : ""}</>}
          </span>
        ) : <>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status | "over" | "abrir")}>
          {box && <option value="abrir">Abrir…</option>}
          {STATUSES.filter((s) => s !== "projeto" || mine.length > 0 || status === "projeto").map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          <option value="over">Dei over…</option>
        </select>
        {status === "abrir" && box && (
          <div style={{ marginTop: 4, minWidth: 220 }}>
            {picked ? (
              <div className="row" style={{ gap: 6, alignItems: "center" }}>
                <span>Saiu <b>{picked.name}</b>{picked.price != null && <span className="dim"> · {kz(picked.price)}</span>}</span>
                <button type="button" className="btn small ghost" onClick={() => { setCard(null); setFind(""); }}>trocar</button>
              </div>
            ) : <>
              <input autoFocus placeholder={`Buscar carta (${box.items.length})`} value={find} style={{ width: "100%" }}
                onChange={(e) => setFind(e.target.value)} />
              {hits.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                  {hits.map((c) => (
                    <button key={c.id} type="button" className="btn small ghost" style={{ justifyContent: "space-between", display: "flex", textAlign: "left" }}
                      onClick={() => setCard(c.id)}>
                      <span>{c.name}</span><span className="dim">{c.price != null ? kz(c.price) : "—"}</span>
                    </button>
                  ))}
                </div>
              )}
              {find.trim().length >= 2 && hits.length === 0 && <div className="dim" style={{ fontSize: 12 }}>Nenhuma carta com esse nome</div>}
            </>}
            {d.qty > 1 && <div className="dim" style={{ fontSize: 11 }}>Abre 1 de {d.qty} por vez</div>}
          </div>
        )}
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
        {d.status !== "usado" && <button className="btn small" disabled={!dirty || pending || (status === "projeto" && !proj) || (status === "abrir" && !card)} onClick={save}>{pending ? "…" : status === "abrir" ? "Abrir" : "Salvar"}</button>}{" "}
        {onDelete}
      </td>
    </tr>
  );
}
