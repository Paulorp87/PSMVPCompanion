"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveHistory } from "@/app/actions";

type Drop = { id: number; name: string; rate: number };
type Saved = { item_id: number; item_name: string; qty: number };

const pct = (rate: number) => (rate / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";

export default function HistoryForm({ characterId, mvp, kills, drops, saved, complete, open, loadError }: {
  characterId: number; mvp: string; kills: number; drops: Drop[]; saved: Saved[]; complete: boolean; open: boolean; loadError: boolean;
}) {
  const savedMap = new Map(saved.map((s) => [s.item_id, s.qty]));
  // uma linha por item da tabela (mesmo ID pode aparecer 2x na tabela; junta)
  const tableItems = [...new Map(drops.map((d) => [d.id, d])).values()];
  const extraSaved = saved.filter((s) => !tableItems.some((d) => d.id === s.item_id));

  const [vals, setVals] = useState<Record<number, string>>(
    Object.fromEntries(saved.map((s) => [s.item_id, String(s.qty)])));
  const [extras, setExtras] = useState<{ id: string; name: string; qty: string }[]>(
    [...extraSaved.map((s) => ({ id: String(s.item_id), name: s.item_name, qty: String(s.qty) })), { id: "", name: "", qty: "" }]);
  const [isComplete, setComplete] = useState(complete);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const filled = Object.values(vals).filter((v) => v !== "" && Number(v) > 0).length + extras.filter((e) => e.id && Number(e.qty) > 0).length;

  function submit() {
    const items = [
      ...tableItems.map((d) => ({ item_id: d.id, item_name: d.name, qty: Number(vals[d.id] || 0) })),
      ...extras.filter((e) => e.id).map((e) => ({ item_id: Number(e.id), item_name: e.name || `Item ${e.id}`, qty: Number(e.qty || 0) })),
    ];
    start(async () => {
      const r = await saveHistory(characterId, mvp, items, isComplete);
      setMsg({ ok: r.ok, text: r.msg });
      router.refresh();
    });
  }

  return (
    <details className="panel" open={open} style={{ padding: "10px 14px" }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        {mvp} <span className="dim" style={{ fontWeight: 400 }}>· {kills.toLocaleString("pt-BR")} kills{complete ? " · histórico completo" : saved.length ? ` · ${saved.length} item(s) preenchidos` : ""}</span>
      </summary>
      {msg && <p className={`flash${msg.ok ? "" : " err"}`} style={{ marginTop: 10 }}>{msg.text}</p>}
      {loadError && <p className="note down">Não consegui carregar a tabela de drops do Payon Stories Tools. Dá para adicionar os itens pelo ID abaixo.</p>}
      <div className="tbl" style={{ marginTop: 10 }}>
        <table>
          <thead><tr><th className="r">ID</th><th>Item</th><th className="r">Taxa</th><th className="r">Qtd até hoje</th><th className="r">Sua taxa</th></tr></thead>
          <tbody>
            {tableItems.map((d) => {
              const v = vals[d.id] ?? "";
              const real = kills > 0 && v ? (Number(v) / kills) * 100 : null;
              const off = real != null && d.rate > 0 && real > (d.rate / 100) * 3 && Number(v) >= 3;
              return (
                <tr key={d.id}>
                  <td className="r num"><b>{d.id}</b></td>
                  <td>{d.name}</td>
                  <td className="r num dim">{pct(d.rate)}</td>
                  <td className="r"><input className="kc-in num" inputMode="numeric" placeholder="0" value={v}
                    onChange={(e) => setVals({ ...vals, [d.id]: e.target.value.replace(/\D/g, "") })} /></td>
                  <td className={`r num ${off ? "down" : "dim"}`} title={off ? "Bem acima da taxa oficial — confira o número" : ""}>
                    {real != null ? real.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%" : "—"}
                  </td>
                </tr>
              );
            })}
            {extras.map((e, i) => (
              <tr key={"x" + i}>
                <td className="r"><input placeholder="ID" inputMode="numeric" value={e.id} style={{ width: 80, textAlign: "right" }}
                  onChange={(ev) => { const x = [...extras]; x[i] = { ...e, id: ev.target.value.replace(/\D/g, "") }; if (i === x.length - 1 && ev.target.value) x.push({ id: "", name: "", qty: "" }); setExtras(x); }} /></td>
                <td><input placeholder="Outro item (ex.: MVP reward)" value={e.name} style={{ width: "100%", minWidth: 160 }}
                  onChange={(ev) => { const x = [...extras]; x[i] = { ...e, name: ev.target.value }; setExtras(x); }} /></td>
                <td className="r dim">—</td>
                <td className="r"><input className="kc-in num" inputMode="numeric" placeholder="0" value={e.qty}
                  onChange={(ev) => { const x = [...extras]; x[i] = { ...e, qty: ev.target.value.replace(/\D/g, "") }; setExtras(x); }} /></td>
                <td className="r dim">{kills > 0 && e.qty ? ((Number(e.qty) / kills) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: 12, justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={isComplete} onChange={(e) => setComplete(e.target.checked)} />
          <span>Histórico completo: todos os itens que caíram neste personagem estão aqui</span>
        </label>
        <button className="btn" disabled={pending} onClick={submit}>{pending ? "Salvando…" : `Salvar drops (${filled})`}</button>
      </div>
      <p className="note">Com histórico completo, a rentabilidade usa todas as {kills.toLocaleString("pt-BR")} kills deste personagem em {mvp}. Sem a marcação, os números ficam salvos mas não entram na conta.</p>
    </details>
  );
}
