"use client";
import { useState, useTransition } from "react";
import { quickDrop, undoDrop } from "@/app/actions";
import { STATUS_LABEL, type Status } from "@/lib/status";

type Char = { id: number; name: string; sprite: string | null; mvps: string[] };
type Drop = { id: number; name: string; rate: number };
type Done = { id: number; text: string; undone?: boolean };

const pct = (rate: number) => (rate / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";

export default function QuickDrop({ chars, tables }: { chars: Char[]; tables: Record<string, Drop[]> }) {
  const [char, setChar] = useState<Char | null>(null);
  const [mvp, setMvp] = useState<string | null>(null);
  const [other, setOther] = useState(false);
  const [qty, setQty] = useState(1);
  const [split, setSplit] = useState(1);
  const [status, setStatus] = useState<Status>("sem_status");
  const [price, setPrice] = useState("");
  const [done, setDone] = useState<Done[]>([]);
  const [pending, start] = useTransition();
  const allMvps = Object.keys(tables).sort();
  const mvpList = char ? (other || char.mvps.length === 0 ? allMvps : char.mvps) : [];

  function register(d: Drop) {
    if (!mvp) return;
    start(async () => {
      const id = await quickDrop(char?.id ?? null, mvp, d.id, d.name, qty, split, status, price ? Number(price) : null);
      setDone((x) => [{ id, text: `${d.name}${qty > 1 ? ` ×${qty}` : ""}${split > 1 ? ` (÷${split})` : ""} — ${mvp} · ${char?.name ?? ""} · ${STATUS_LABEL[status]}${status === "vendido" && price ? ` por ${Number(price).toLocaleString("pt-BR")} z` : ""}` }, ...x].slice(0, 8));
      setQty(1); setSplit(1); setStatus("sem_status"); setPrice("");
    });
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {done.length > 0 && (
        <div className="panel" style={{ display: "grid", gap: 6 }}>
          {done.map((d, i) => (
            <div key={d.id} className="row" style={{ justifyContent: "space-between", alignItems: "center", opacity: d.undone ? 0.5 : 1 }}>
              <span className={i === 0 && !d.undone ? "up" : ""}>{d.undone ? "Desfeito: " : "✓ "}{d.text}</span>
              {!d.undone && <button className="btn ghost small" onClick={() => start(async () => { await undoDrop(d.id); setDone((x) => x.map((y) => y.id === d.id ? { ...y, undone: true } : y)); })}>Desfazer</button>}
            </div>
          ))}
        </div>
      )}

      <section>
        <h2 style={{ marginTop: 0 }}>1. Personagem {char && <span className="dim" style={{ fontWeight: 400 }}>· {char.name} <button className="btn ghost small" onClick={() => { setChar(null); setMvp(null); setOther(false); }}>trocar</button></span>}</h2>
        {!char && (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}>
            {chars.map((c) => (
              <button key={c.id} className="char" style={{ cursor: "pointer", padding: 0, font: "inherit", color: "inherit", textAlign: "left" }}
                onClick={() => { setChar(c); setMvp(c.mvps.length === 1 ? c.mvps[0] : null); }}>
                <div className="art">{c.sprite ? <img src={c.sprite} alt="" /> : <span className="none">＋</span>}</div>
                <div className="nm" title={c.name}>{c.name}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {char && (
        <section>
          <h2 style={{ marginTop: 0 }}>2. MVP {mvp && <span className="dim" style={{ fontWeight: 400 }}>· {mvp} <button className="btn ghost small" onClick={() => setMvp(null)}>trocar</button></span>}</h2>
          {!mvp && (
            <>
              <div className="row" style={{ gap: 8 }}>
                {mvpList.map((m) => <button key={m} className="btn ghost" onClick={() => setMvp(m)}>{m}</button>)}
              </div>
              {!other && char.mvps.length > 0 && <p className="note"><button className="btn ghost small" onClick={() => setOther(true)}>Outro MVP…</button></p>}
            </>
          )}
        </section>
      )}

      {char && mvp && (
        <section>
          <h2 style={{ marginTop: 0 }}>3. Item</h2>
          <div className="row" style={{ marginBottom: 12, alignItems: "center" }}>
            <span className="dim">Quantidade</span>
            {[1, 2, 3, 5].map((n) => <button key={n} className={`btn small ${qty === n ? "" : "ghost"}`} onClick={() => setQty(n)}>{n}</button>)}
            <span className="dim" style={{ marginLeft: 12 }}>Dividido entre</span>
            {[1, 2, 3, 4].map((n) => <button key={n} className={`btn small ${split === n ? "" : "ghost"}`} onClick={() => setSplit(n)}>{n === 1 ? "só eu" : n}</button>)}
          </div>
          <div className="row" style={{ marginBottom: 12, alignItems: "center" }}>
            <span className="dim">Destino</span>
            {(["sem_status", "guardando", "loja", "vendido"] as Status[]).map((s) => (
              <button key={s} className={`btn small ${status === s ? "" : "ghost"}`} onClick={() => setStatus(s)}>{STATUS_LABEL[s]}</button>
            ))}
            {status === "vendido" && (
              <input placeholder="Preço por unidade" inputMode="numeric" value={price} style={{ width: 160 }}
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
            )}
          </div>
          {(tables[mvp] ?? []).length === 0 ? <p className="note">Sem tabela de drop para {mvp}. Registre pela página Drops com o ID do item.</p> : (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
              {tables[mvp].map((d) => (
                <button key={d.id} className="panel" disabled={pending} onClick={() => register(d)}
                  style={{ cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit", display: "grid", gap: 2 }}>
                  <b>{d.name}</b>
                  <span className="dim" style={{ fontSize: 12 }}>#{d.id} · {pct(d.rate)}</span>
                </button>
              ))}
            </div>
          )}
          <p className="note">Elunium e Oridecon não aparecem aqui: eles são controlados pela página Estoque.</p>
        </section>
      )}
    </div>
  );
}
