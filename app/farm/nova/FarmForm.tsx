"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFarmSession } from "@/app/actions";
import type { Loot, Dest } from "@/lib/farm";

type Row = { id: number; name: string; qty: string; dest: Dest; price: string; market: number | null; npc: number | null; source: string | null; from: Loot["from"]; extra?: boolean };
type Cost = { key: number; id: number | null; name: string; qty: string; price: string };

const n = (v: number) => Math.round(v).toLocaleString("pt-BR");
const num = (s: string) => Number(s.replace(/\D/g, "")) || 0;
const pct = (r: number) => (r / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
const norm = (t: string) => t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function FarmForm({ mapId, mapName, characterId, today, loot, consumables }: {
  mapId: string; mapName: string; characterId: number; today: string; loot: Loot[];
  consumables: { id: number; name: string; price: number | null }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [day, setDay] = useState(today);
  const [minutes, setMinutes] = useState("");
  const [find, setFind] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [oc, setOc] = useState("24");
  const [rows, setRows] = useState<Row[]>(() => loot.map((l) => ({
    id: l.id, name: l.name, qty: "", dest: l.kind === "npc" ? "npc" : "vender", price: l.price != null ? String(Math.round(l.price)) : "",
    market: l.price, npc: l.npc, source: l.source, from: l.from,
  })));
  // NPC: preço do NPC + Superfaturar
  const npcPrice = (r: Row) => (r.npc != null ? Math.floor(r.npc * (1 + num(oc) / 100)) : 0);
  const eff = (r: Row) => (r.dest === "npc" ? npcPrice(r) : num(r.price));
  const [costs, setCosts] = useState<Cost[]>([]);
  const [extra, setExtra] = useState({ name: "", qty: "", dest: "vender" as Dest, price: "" });

  const set = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const setC = (k: number, p: Partial<Cost>) => setCosts((c) => c.map((x) => (x.key === k ? { ...x, ...p } : x)));

  const calc = useMemo(() => {
    let sold = 0, stored = 0, shop = 0;
    for (const r of rows) {
      const v = num(r.qty) * eff(r);
      if (r.dest === "vender" || r.dest === "npc") sold += v; else if (r.dest === "guardar") stored += v; else shop += v;
    }
    const c = costs.reduce((a, x) => a + num(x.qty) * num(x.price), 0);
    const k = num(minutes) / 5;
    return { sold, stored, shop, costs: c, real: sold - c, pot: sold + stored + shop - c, k };
  }, [rows, costs, minutes, oc]);

  const f = norm(find.trim());
  const shown = rows.map((r, i) => ({ r, i })).filter(({ r }) =>
    (!onlyMine || num(r.qty) > 0) && (!f || norm(r.name).includes(f) || r.from.some((x) => norm(x.mob).includes(f))));

  function addExtra() {
    if (!extra.name.trim() || !num(extra.qty)) return;
    setRows((r) => [...r, { id: 0, name: extra.name.trim(), qty: extra.qty, dest: extra.dest === "npc" ? "vender" : extra.dest, price: extra.price, market: null, npc: null, source: null, from: [], extra: true }]);
    setExtra({ name: "", qty: "", dest: "vender", price: "" });
  }
  function addCost(id: string) {
    const c = consumables.find((x) => String(x.id) === id);
    setCosts((cs) => [...cs, { key: Date.now(), id: c?.id ?? null, name: c?.name ?? "", qty: "1", price: c?.price != null ? String(Math.round(c.price)) : "" }]);
  }
  function save() {
    setMsg("");
    start(async () => {
      const r = await createFarmSession({
        day, mapId, mapName, characterId, minutes: num(minutes), overcharge: num(oc),
        items: rows.filter((x) => num(x.qty) > 0).map((x) => ({ id: x.id, name: x.name, qty: num(x.qty), dest: x.dest,
          price: x.dest === "npc" ? npcPrice(x) : x.price ? num(x.price) : null })),
        costs: costs.map((x) => ({ id: x.id, name: x.name, qty: num(x.qty), price: num(x.price) })),
      });
      if (r.ok && r.id) router.push(`/farm/${r.id}`); else setMsg(r.msg);
    });
  }

  const per5 = (v: number) => (calc.k > 0 ? n(v / calc.k) : "—");

  return (
    <>
      <h2>Sessão</h2>
      <div className="panel row" style={{ gap: 12, flexWrap: "wrap" }}>
        <label className="f">Data<input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
        <label className="f">Tempo farmando (min)<input className="num" inputMode="numeric" value={minutes} placeholder="ex.: 60" style={{ width: 120 }}
          onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} /></label>
        <label className="f">Superfaturar (%)<input className="num" inputMode="numeric" value={oc} style={{ width: 90 }}
          onChange={(e) => setOc(String(Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0)))} /></label>
      </div>

      <h2>Loots do mapa</h2>
      <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="Filtrar item ou monstro" value={find} onChange={(e) => setFind(e.target.value)} />
        <label className="row" style={{ gap: 4, alignItems: "center" }}><input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> só o que peguei</label>
      </div>
      <p className="note">Coloque quantos pegou de cada um e o destino. Raw loot já vem em NPC, com o preço do NPC + Superfaturar. Os outros vêm com a média da Price Check: em "Vendi (PC)" troque pelo preço que vendeu (por unidade); em Guardar e Lojinha ele é o valor estimado. Lojinha manda o item pra lista de Drops, e quando você vender lá o valor entra aqui como lucro real.</p>
      <div className="tbl"><table>
        <thead><tr><th>Item</th><th className="r">Qtd</th><th>Destino</th><th className="r">Preço un.</th><th className="r">Total</th></tr></thead>
        <tbody>{shown.map(({ r, i }) => (
          <tr key={i} style={num(r.qty) ? undefined : { opacity: 0.75 }}>
            <td>{r.name} {r.id > 0 && <span className="dim">#{r.id}</span>}
              <div className="dim" style={{ fontSize: 11 }}>{r.extra ? "fora da tabela" : r.from.map((x) => `${x.mob} ${pct(x.rate)}`).join(" · ")}</div></td>
            <td className="r"><input className="kc-in num" inputMode="numeric" style={{ width: 64 }} value={r.qty} placeholder="0"
              onChange={(e) => set(i, { qty: e.target.value.replace(/\D/g, "") })} /></td>
            <td><select value={r.dest} onChange={(e) => set(i, { dest: e.target.value as Dest })}>
              <option value="vender">Vendi (PC)</option>{r.npc != null && <option value="npc">NPC</option>}<option value="guardar">Guardar</option><option value="loja">Lojinha</option></select></td>
            <td className="r">{r.dest === "npc"
              ? <span className="num" title={`NPC ${n(r.npc ?? 0)} + ${num(oc)}%`}>{n(npcPrice(r))}</span>
              : <input className="kc-in num" inputMode="numeric" style={{ width: 110 }} value={r.price} placeholder={r.market == null ? "sem preço" : ""}
                  title={r.source ?? "sem venda registrada"} onChange={(e) => set(i, { price: e.target.value.replace(/\D/g, "") })} />}</td>
            <td className="r num">{num(r.qty) ? n(num(r.qty) * eff(r)) : ""}</td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className="panel row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 8 }}>
        <label className="f">Outro item<input value={extra.name} placeholder="nome" onChange={(e) => setExtra({ ...extra, name: e.target.value })} /></label>
        <label className="f">Qtd<input className="num" inputMode="numeric" style={{ width: 64 }} value={extra.qty} onChange={(e) => setExtra({ ...extra, qty: e.target.value.replace(/\D/g, "") })} /></label>
        <label className="f">Destino<select value={extra.dest} onChange={(e) => setExtra({ ...extra, dest: e.target.value as Dest })}>
          <option value="vender">Vendi</option><option value="guardar">Guardar</option><option value="loja">Lojinha</option></select></label>
        <label className="f">Preço un.<input className="num" inputMode="numeric" style={{ width: 110 }} value={extra.price} onChange={(e) => setExtra({ ...extra, price: e.target.value.replace(/\D/g, "") })} /></label>
        <button type="button" className="btn small" onClick={addExtra}>Adicionar</button>
      </div>

      <h2>Consumíveis</h2>
      {costs.length > 0 && (
        <div className="tbl"><table>
          <thead><tr><th>Item</th><th className="r">Qtd</th><th className="r">Preço un.</th><th className="r">Total</th><th></th></tr></thead>
          <tbody>{costs.map((c) => (
            <tr key={c.key}>
              <td>{c.id ? c.name : <input value={c.name} placeholder="nome" onChange={(e) => setC(c.key, { name: e.target.value })} />}</td>
              <td className="r"><input className="kc-in num" inputMode="numeric" style={{ width: 64 }} value={c.qty} onChange={(e) => setC(c.key, { qty: e.target.value.replace(/\D/g, "") })} /></td>
              <td className="r"><input className="kc-in num" inputMode="numeric" style={{ width: 100 }} value={c.price} onChange={(e) => setC(c.key, { price: e.target.value.replace(/\D/g, "") })} /></td>
              <td className="r num">{n(num(c.qty) * num(c.price))}</td>
              <td><button type="button" className="btn small ghost" onClick={() => setCosts((cs) => cs.filter((x) => x.key !== c.key))}>✕</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <select value="" onChange={(e) => e.target.value && addCost(e.target.value)} style={{ marginTop: 6 }}>
        <option value="">+ Adicionar consumível…</option>
        {consumables.map((c) => <option key={c.id} value={c.id}>{c.name}{c.price != null ? ` (${n(c.price)})` : ""}</option>)}
        <option value="outro">Outro…</option>
      </select>

      <h2>Resultado</h2>
      <div className="stats">
        <div className="stat"><div className="k">Lucro real</div><div className={`v num ${calc.real < 0 ? "down" : ""}`}>{n(calc.real)} z</div><div className="note num">{per5(calc.real)} z / 5 min</div></div>
        <div className="stat"><div className="k">Valor potencial</div><div className="v num accent">{n(calc.pot)} z</div><div className="note num">{per5(calc.pot)} z / 5 min</div></div>
        <div className="stat"><div className="k">Vendido (PC + NPC) · guardado · lojinha</div><div className="v num" style={{ fontSize: 16 }}>{n(calc.sold)} · {n(calc.stored)} · {n(calc.shop)}</div><div className="note num">consumíveis −{n(calc.costs)}</div></div>
      </div>
      {msg && <p className="flash err">{msg}</p>}
      <button className="btn" disabled={pending} onClick={save}>{pending ? "Salvando…" : "Salvar sessão"}</button>
    </>
  );
}
