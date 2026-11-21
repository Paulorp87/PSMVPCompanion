"use client";
import { useState, useTransition } from "react";
import { potei } from "@/app/actions";

export default function Potei({ herbId, potion, max }: { herbId: number; potion: string; max: number }) {
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState("");
  const [pots, setPots] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, start] = useTransition();
  const u = Number(used) || 0, p = Number(pots) || 0;

  if (!open)
    return (
      <div>
        <select value="" onChange={(e) => { if (e.target.value === "potei") { setOpen(true); setMsg(null); } }}>
          <option value="">Ação…</option>
          <option value="potei" disabled={max <= 0}>Potei</option>
        </select>
        {msg && <div className={msg.ok ? "up" : "down"} style={{ fontSize: 12, marginTop: 4 }}>{msg.msg}</div>}
      </div>
    );
  return (
    <div className="row" style={{ gap: 6, alignItems: "flex-end", flexWrap: "wrap" }}>
      <label className="f" style={{ fontSize: 12 }}>Ervas usadas
        <input className="kc-in num" inputMode="numeric" autoFocus style={{ width: 90 }} value={used} placeholder={`até ${max}`}
          onChange={(e) => setUsed(e.target.value.replace(/\D/g, ""))} /></label>
      <label className="f" style={{ fontSize: 12 }}>{potion}s que saíram
        <input className="kc-in num" inputMode="numeric" style={{ width: 90 }} value={pots}
          onChange={(e) => setPots(e.target.value.replace(/\D/g, ""))} /></label>
      {u > 0 && <span className="dim" style={{ fontSize: 12 }}>{((p / u) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>}
      <button className="btn small" disabled={pending || !u || p > u || u > max}
        onClick={() => start(async () => { const r = await potei(herbId, u, p); setMsg(r); if (r.ok) { setOpen(false); setUsed(""); setPots(""); } })}>
        {pending ? "…" : "Salvar"}</button>
      <button className="btn small ghost" type="button" onClick={() => setOpen(false)}>cancelar</button>
      {msg && !msg.ok && <div className="down" style={{ fontSize: 12, width: "100%" }}>{msg.msg}</div>}
      {u > max && <div className="down" style={{ fontSize: 12, width: "100%" }}>Você tem {max} no estoque.</div>}
    </div>
  );
}
