"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveKC } from "@/app/actions";
import type { CharMvp } from "@/lib/data";

const n = (x: number) => x.toLocaleString("pt-BR");
const fmt = (iso: string) => iso.split("-").reverse().join("/");

export default function KcForm({ characterId, rows, mvpNames, today }:
  { characterId: number; rows: CharMvp[]; mvpNames: string[]; today: string }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<{ mvp: string; kills: string }[]>([{ mvp: "", kills: "" }]);
  const [week, setWeek] = useState(today);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const known = new Set(rows.map((r) => r.mvp.toLowerCase()));

  const changed = rows.filter((r) => vals[r.mvp] !== undefined && vals[r.mvp] !== "" && Number(vals[r.mvp]) !== r.kills);
  const lower = changed.filter((r) => Number(vals[r.mvp]) < r.kills);
  const newOnes = extra.filter((e) => e.mvp.trim() && e.kills !== "");
  const weekDiff = changed.reduce((a, r) => a + Number(vals[r.mvp]) - r.kills, 0) + newOnes.reduce((a, e) => a + Number(e.kills), 0);

  function submit() {
    if (lower.length && !confirm(`Atenção: ${lower.map((r) => r.mvp).join(", ")} ficou com KC menor que antes. Salvar mesmo assim?`)) return;
    const entries = [
      ...changed.map((r) => ({ mvp: r.mvp, kills: Number(vals[r.mvp]) })),
      ...newOnes.map((e) => ({ mvp: e.mvp, kills: Number(e.kills) })),
    ];
    start(async () => {
      const r = await saveKC(characterId, week, entries);
      setMsg({ ok: r.ok, text: r.msg });
      if (r.ok) { setVals({}); setExtra([{ mvp: "", kills: "" }]); router.refresh(); }
    });
  }

  return (
    <div>
      {msg && <p className={`flash${msg.ok ? "" : " err"}`}>{msg.text}</p>}
      <div className="tbl">
        <table>
          <thead><tr><th>MVP</th><th className="r">Último KC</th><th className="r">Novo KC</th><th className="r">Diferença</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const v = vals[r.mvp] ?? "";
              const d = v === "" ? 0 : Number(v) - r.kills;
              return (
                <tr key={r.mvp}>
                  <td>{r.mvp}</td>
                  <td className="r num">{n(r.kills)} <span className="dim" style={{ fontSize: 12 }}>({fmt(r.week)})</span></td>
                  <td className="r">
                    <input className={`kc-in num${d < 0 ? " warn" : ""}`} inputMode="numeric" placeholder={String(r.kills)}
                      value={v} onChange={(e) => setVals({ ...vals, [r.mvp]: e.target.value.replace(/\D/g, "") })} />
                  </td>
                  <td className={`r num ${d > 0 ? "up" : d < 0 ? "down" : "dim"}`}>{d ? (d > 0 ? "+" : "") + n(d) : "—"}</td>
                </tr>
              );
            })}
            {extra.map((e, i) => {
              const dup = e.mvp.trim() && known.has(e.mvp.trim().toLowerCase());
              return (
                <tr key={"x" + i}>
                  <td>
                    <input list="mvp-names" placeholder="+ MVP novo" value={e.mvp} style={{ width: "100%", minWidth: 150 }}
                      className={dup ? "warn" : ""}
                      onChange={(ev) => { const x = [...extra]; x[i] = { ...e, mvp: ev.target.value }; if (i === x.length - 1 && ev.target.value) x.push({ mvp: "", kills: "" }); setExtra(x); }} />
                    {dup && <div className="note down">Já está na lista acima.</div>}
                  </td>
                  <td className="r dim">—</td>
                  <td className="r"><input className="kc-in num" inputMode="numeric" value={e.kills}
                    onChange={(ev) => { const x = [...extra]; x[i] = { ...e, kills: ev.target.value.replace(/\D/g, "") }; setExtra(x); }} /></td>
                  <td className="r num up">{e.kills ? "+" + n(Number(e.kills)) : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <datalist id="mvp-names">{mvpNames.map((m) => <option key={m} value={m} />)}</datalist>

      <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
        <label className="f">Data deste KC<input type="date" value={week} onChange={(e) => setWeek(e.target.value)} /></label>
        <div className="row" style={{ alignItems: "center" }}>
          <span className="num">Diferença: <b className={weekDiff > 0 ? "up" : weekDiff < 0 ? "down" : ""}>{weekDiff > 0 ? "+" : ""}{n(weekDiff)}</b></span>
          <button className="btn" disabled={pending || (!changed.length && !newOnes.length) || newOnes.some((e) => known.has(e.mvp.trim().toLowerCase()))} onClick={submit}>
            {pending ? "Salvando…" : "Salvar KC"}
          </button>
        </div>
      </div>
      <p className="note">Use a mesma data para todos os personagens da semana. Se salvar de novo na mesma data, o valor é corrigido.</p>
    </div>
  );
}
