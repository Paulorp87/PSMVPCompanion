"use client";
import { useEffect, useState } from "react";
import { addDrop } from "@/app/actions";

type Drop = { id: number; name: string; rate: number };

export default function DropForm({ mvps, chars, today, initialMvp }:
  { mvps: string[]; chars: { id: number; name: string }[]; today: string; initialMvp?: string }) {
  const [mvp, setMvp] = useState(initialMvp ?? "");
  const [drops, setDrops] = useState<Drop[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [item, setItem] = useState("");
  const [otherId, setOtherId] = useState("");
  const [otherName, setOtherName] = useState("");

  useEffect(() => {
    const name = mvp.trim();
    setDrops(null); setItem(""); setErr("");
    if (name.length < 3) return;
    let alive = true;
    const known = mvps.some((m) => m.toLowerCase() === name.toLowerCase());
    const t = setTimeout(() => {
    setLoading(true);
    fetch(`/api/mvp-drops?name=${encodeURIComponent(name)}`).then((r) => r.json()).then((j) => {
      if (!alive) return;
      setDrops(j.drops ?? []);
      if (j.error) setErr("Não consegui acessar o Payon Stories Tools agora. Use \"Outro item\" com o ID ou tente de novo.");
      else if (!j.mob_id) setErr("Não achei esse MVP no Payon Stories Tools. Use \"Outro item\" com o ID.");
    }).catch(() => alive && setErr("Não consegui buscar os drops agora.")).finally(() => alive && setLoading(false));
    }, known ? 0 : 700);
    return () => { alive = false; clearTimeout(t); };
  }, [mvp, mvps]);

  const sel = drops?.find((d) => String(d.id) === item);
  const isOther = item === "outro" || (drops !== null && drops.length === 0);
  const itemId = isOther ? otherId : item;
  const itemName = isOther ? otherName : sel?.name ?? "";

  return (
    <form action={addDrop} className="panel" style={{ display: "grid", gap: 12 }}>
      <div className="row">
        <label className="f" style={{ flex: "1 1 200px" }}>MVP
          <input list="mvps" value={mvp} onChange={(e) => setMvp(e.target.value)} name="mvp" required placeholder="ex.: Orc Hero" />
        </label>
        <label className="f" style={{ flex: "1 1 260px" }}>Item
          <select value={item} onChange={(e) => setItem(e.target.value)} disabled={!drops} required={!isOther}>
            <option value="">{loading ? "Carregando drops…" : drops ? "Escolha o item" : "Escolha o MVP primeiro"}</option>
            {drops?.map((d) => <option key={d.id + "-" + d.rate} value={d.id}>{d.name} ({(d.rate / 100).toLocaleString("pt-BR")}%)</option>)}
            {drops && <option value="outro">Outro item (pelo ID)</option>}
          </select>
        </label>
      </div>
      {isOther && (
        <div className="row">
          <label className="f">ID do item<input value={otherId} onChange={(e) => setOtherId(e.target.value.replace(/\D/g, ""))} required inputMode="numeric" style={{ width: 120 }} /></label>
          <label className="f" style={{ flex: 1 }}>Nome do item<input value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="opcional" /></label>
        </div>
      )}
      <div className="row">
        <label className="f">Quantidade<input name="qty" type="number" min={1} defaultValue={1} style={{ width: 90 }} /></label>
        <label className="f" style={{ flex: "1 1 180px" }}>Personagem (opcional)
          <select name="character_id" defaultValue="">
            <option value="">—</option>
            {chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="f">Data<input type="date" name="dropped_on" defaultValue={today} /></label>
        <input type="hidden" name="item_id" value={itemId} />
        <input type="hidden" name="item_name" value={itemName} />
        <button className="btn" disabled={!mvp || !itemId}>Registrar drop</button>
      </div>
      {err && <p className="note down" style={{ margin: 0 }}>{err}</p>}
      <datalist id="mvps">{mvps.map((m) => <option key={m} value={m} />)}</datalist>
    </form>
  );
}
