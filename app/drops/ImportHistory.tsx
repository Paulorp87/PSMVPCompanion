"use client";
import { useState, useTransition } from "react";
import { importFromHistory } from "@/app/actions";
import { STATUS_LABEL } from "@/lib/status";

type H = { character_id: number; char: string; mvp: string; item_id: number; item_name: string; free: number };
type Proj = { id: number; name: string; item_id: number };

export default function ImportHistory({ rows, projects }: { rows: H[]; projects: Proj[] }) {
  const [sel, setSel] = useState("");
  const [n, setN] = useState("1");
  const [status, setStatus] = useState("guardando");
  const [proj, setProj] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const h = rows.find((r) => `${r.character_id}|${r.mvp}|${r.item_id}` === sel);
  const mine = h ? projects.filter((p) => p.item_id === h.item_id) : [];

  if (!rows.length) return <p className="note">Nenhum "Drops até hoje" preenchido ainda. Preencha na página do personagem.</p>;

  return (
    <div className="panel" style={{ display: "grid", gap: 10 }}>
      {msg && <p className={`flash${msg.ok ? "" : " err"}`} style={{ margin: 0 }}>{msg.text}</p>}
      <div className="row">
        <label className="f" style={{ flex: "1 1 280px" }}>Item do histórico
          <select value={sel} onChange={(e) => { setSel(e.target.value); setN("1"); setProj(""); }}>
            <option value="">Escolha</option>
            {rows.map((r) => (
              <option key={`${r.character_id}|${r.mvp}|${r.item_id}`} value={`${r.character_id}|${r.mvp}|${r.item_id}`} disabled={r.free < 1}>
                {r.item_name} — {r.char} ({r.mvp}) · {r.free} disponível(is)
              </option>
            ))}
          </select>
        </label>
        <label className="f">Quantos<input className="kc-in num" inputMode="numeric" value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, ""))} style={{ width: 80 }} /></label>
        <label className="f">Destino
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {(["guardando", "loja", "vendido", "projeto"] as const).filter((s) => s !== "projeto" || mine.length).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        {status === "projeto" && (
          <label className="f">Projeto
            <select value={proj} onChange={(e) => setProj(e.target.value)}>
              <option value="">Escolha</option>
              {mine.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <button className="btn" disabled={!h || !Number(n) || Number(n) > (h?.free ?? 0) || pending || (status === "projeto" && !proj)}
          onClick={() => h && start(async () => {
            const r = await importFromHistory(h.character_id, h.mvp, h.item_id, Number(n), status, proj ? Number(proj) : null);
            setMsg({ ok: r.ok, text: r.msg });
          })}>
          {pending ? "Importando…" : "Importar do histórico"}
        </button>
      </div>
      <p className="note" style={{ margin: 0 }}>Os importados ganham destino, mas não contam de novo na rentabilidade, porque já estão nos "Drops até hoje".</p>
    </div>
  );
}
