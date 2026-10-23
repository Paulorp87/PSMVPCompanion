import { q } from "@/lib/db";
import { getCharacters, fmtDate } from "@/lib/data";
import { STOCK_IDS } from "@/lib/stock";
import Link from "next/link";
import BarChart, { type Bar } from "./BarChart";
import { chanceOne, type ItemType } from "@/lib/refine";

export const dynamic = "force-dynamic";

const n = (x: number) => Math.round(x).toLocaleString("pt-BR");
const dm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

type Row = { character_id: number; mvp: string; kills: number };

export default async function Estatisticas({ searchParams }: { searchParams: Promise<{ mvp?: string; char?: string }> }) {
  const sp = await searchParams;
  const mvpF = sp.mvp || null;
  const charF = sp.char ? Number(sp.char) : null;

  const weeks = (await q<{ w: string }>("SELECT DISTINCT to_char(week,'YYYY-MM-DD') AS w FROM kc ORDER BY w")).map((r) => r.w);
  const [chars, mvps] = await Promise.all([
    getCharacters(),
    q<{ mvp: string }>("SELECT DISTINCT mvp FROM kc ORDER BY mvp"),
  ]);

  // KC vigente de cada (personagem, MVP) em cada semana
  const kcAt = await Promise.all(weeks.map((w) => q<Row>(
    `SELECT DISTINCT ON (character_id, mvp) character_id, mvp, kills FROM kc WHERE week <= $1::date ORDER BY character_id, mvp, week DESC`, [w])));
  const keep = (r: { character_id: number | null; mvp: string }) => (!mvpF || r.mvp === mvpF) && (!charF || r.character_id === charF);
  const totalAt = kcAt.map((rows) => rows.filter(keep).reduce((a, r) => a + r.kills, 0));

  // drops reais (sem importados, sem ovos, sem Elu/Ori) com preço
  const drops = await q<{ character_id: number | null; mvp: string; item_id: number; qty: number; d: string; status: string; sold_price: number | null; split: number; price: number | null }>(
    `SELECT d.character_id, d.mvp, d.item_id, d.qty, to_char(d.dropped_on,'YYYY-MM-DD') AS d, d.status, d.sold_price::float8 AS sold_price, d.split, p.price::float8 AS price
     FROM drops d LEFT JOIN prices p ON p.item_id=d.item_id WHERE d.source='drop'`);
  const realDrops = drops.filter((x) => !STOCK_IDS.includes(x.item_id) && keep(x));
  const supRows = (await q<{ character_id: number | null; mvp: string; d: string }>(
    "SELECT character_id, mvp, to_char(day,'YYYY-MM-DD') AS d FROM support")).filter(keep);
  const firstDrop = realDrops.reduce<string | null>((a, x) => (!a || x.d < a ? x.d : a), null);

  const weeksData = weeks.slice(1).map((w, i) => {
    const prev = weeks[i];
    const kills = totalAt[i + 1] - totalAt[i];
    const inWeek = realDrops.filter((x) => x.d > prev && x.d <= w);
    const value = inWeek.reduce((a, x) => {
      const unit = x.status === "vendido" && x.sold_price != null ? x.sold_price : x.price ?? 0;
      return a + (unit * x.qty) / Math.max(1, x.split);
    }, 0);
    const tracked = !!firstDrop && w >= firstDrop; // semana com registro de drops
    const sup = supRows.filter((x) => x.d > prev && x.d <= w).length;
    const all = kills + sup;
    return { w, prev, kills, sup, all, value, perKill: tracked && all > 0 ? value / all : null };
  });

  const killVals = weeksData.map((x) => x.all);
  const killAvg = killVals.length ? killVals.reduce((a, b) => a + b, 0) / killVals.length : null;
  const profVals = weeksData.map((x) => x.perKill).filter((v): v is number => v != null);
  const profAvg = profVals.length ? profVals.reduce((a, b) => a + b, 0) / profVals.length : null;
  const cur = weeksData[weeksData.length - 1];
  const best = weeksData.reduce<typeof cur | null>((a, x) => (!a || x.all > a.all ? x : a), null);
  const bestProf = weeksData.reduce<typeof cur | null>((a, x) => (x.perKill != null && (!a || x.perKill > (a.perKill ?? -1)) ? x : a), null);
  const vsAvg = (v: number | null | undefined, avg: number | null) => (v == null || !avg ? null : ((v - avg) / avg) * 100);

  const killBars: Bar[] = weeksData.map((x) => ({
    label: dm(x.w), sub: `desde ${dm(x.prev)}`, value: x.kills,
    value2: x.sup,
    tip: `${fmtDate(x.prev)} → ${fmtDate(x.w)}: ${n(x.kills)} kills${x.sup ? ` + ${n(x.sup)} como suporte` : ""}`,
  }));
  const profBars: Bar[] = weeksData.map((x) => ({
    label: dm(x.w), sub: `desde ${dm(x.prev)}`, value: x.perKill,
    tip: x.perKill == null ? `${fmtDate(x.w)}: sem drops registrados` : `${fmtDate(x.w)}: ${n(x.perKill)} z/kill · ${n(x.value)} z em ${n(x.all)} kills${x.sup ? ` (com ${n(x.sup)} de suporte)` : ""}`,
  }));

  // ---- semana atual por MVP / por personagem ----
  const diffBy = (keyOf: (r: Row) => string, i: number) => {
    const m = new Map<string, number>();
    const cur = kcAt[i], prev = kcAt[i - 1];
    const prevMap = new Map(prev.filter(keep).map((r) => [`${r.character_id}|${r.mvp}`, r.kills]));
    for (const r of cur.filter(keep)) {
      const d = r.kills - (prevMap.get(`${r.character_id}|${r.mvp}`) ?? 0);
      if (d) m.set(keyOf(r), (m.get(keyOf(r)) ?? 0) + d);
    }
    return m;
  };
  const breakdown = (keyOf: (r: Row) => string) => {
    const per = weeks.slice(1).map((_, k) => diffBy(keyOf, k + 1));
    const last = per[per.length - 1] ?? new Map();
    const keys = new Set(per.flatMap((m) => [...m.keys()]));
    return [...keys].map((k) => {
      const avg = per.reduce((a, m) => a + (m.get(k) ?? 0), 0) / Math.max(1, per.length);
      return { k, now: last.get(k) ?? 0, avg };
    }).filter((x) => x.now > 0 || x.avg > 0).sort((a, b) => b.now - a.now || b.avg - a.avg);
  };
  const charName = new Map(chars.map((c) => [String(c.id), c.name]));
  const byMvp = weeks.length > 1 && !mvpF ? breakdown((r) => r.mvp) : [];
  const byChar = weeks.length > 1 && !charF ? breakdown((r) => String(r.character_id)) : [];

  // ---- projetos ----
  const projUnits = await q<{ project_id: number; status: string; d: string }>(
    `SELECT project_id, status, to_char(COALESCE((project_at AT TIME ZONE 'America/Chicago')::date, dropped_on),'YYYY-MM-DD') AS d
     FROM drops WHERE project_id IS NOT NULL`);
  const projects = await q<{ id: number; name: string; item_type: ItemType; target_refine: number; status: string }>(
    "SELECT id, name, item_type, target_refine, status FROM projects ORDER BY status, created_at");
  const projBars: Bar[] = weeksData.map((x) => {
    const c = projUnits.filter((u) => u.d > x.prev && u.d <= x.w).length;
    return { label: dm(x.w), sub: `desde ${dm(x.prev)}`, value: c, tip: `${fmtDate(x.prev)} → ${fmtDate(x.w)}: ${c} item(s) enviados para projetos` };
  });
  const projVals = projBars.map((b) => b.value ?? 0);
  const projAvg = projVals.length ? projVals.reduce((a, b) => a + b, 0) / projVals.length : null;
  const sentAfter = cur ? projUnits.filter((u) => u.d > cur.w).length : 0;

  const pctTag = (p: number | null) => p == null ? null : <span className={p >= 0 ? "up" : "down"}>{p >= 0 ? "+" : ""}{Math.round(p)}% vs média</span>;
  const filterName = [mvpF, charF ? chars.find((c) => c.id === charF)?.name : null].filter(Boolean).join(" · ") || "Todos os MVPs e personagens";

  return (
    <>
      <h1>Estatísticas</h1>
      <p className="sub">Cada semana vai de uma entrada de KC até a próxima. {filterName}.</p>

      <form method="get" className="row" style={{ marginBottom: 16 }}>
        <label className="f">MVP
          <select name="mvp" defaultValue={mvpF ?? ""}>
            <option value="">Todos</option>
            {mvps.map((m) => <option key={m.mvp} value={m.mvp}>{m.mvp}</option>)}
          </select>
        </label>
        <label className="f">Personagem
          <select name="char" defaultValue={charF ? String(charF) : ""}>
            <option value="">Todos</option>
            {chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <button className="btn ghost">Filtrar</button>
      </form>

      {weeksData.length === 0 ? <p className="note">Ainda não há duas entradas de KC para comparar.</p> : (
        <>
          <h2 style={{ marginTop: 0 }}>MVPs mortos por semana</h2>
          <div className="stats">
            <div className="stat"><div className="k">Semana atual ({dm(cur.prev)} → {dm(cur.w)})</div><div className="v num accent">{n(cur.all)}</div><div className="note">{cur.sup > 0 && <span className="dim">{n(cur.kills)} solo + {n(cur.sup)} suporte · </span>}{pctTag(vsAvg(cur.all, killAvg))}</div></div>
            <div className="stat"><div className="k">Média por semana</div><div className="v num">{killAvg != null ? n(killAvg) : "—"}</div></div>
            <div className="stat"><div className="k">Melhor semana</div><div className="v num">{best ? n(best.all) : "—"}</div>{best && <div className="note">até {fmtDate(best.w)}</div>}</div>
          </div>
          <div className="panel"><BarChart bars={killBars} avg={killAvg} unit="kills" empty="Sem kills no período." legend={weeksData.some((x) => x.sup > 0) ? ["Kills (solo)", "Suporte"] : undefined} /></div>

          <h2>Rentabilidade por semana (zeny por kill)</h2>
          <div className="stats">
            <div className="stat"><div className="k">Semana atual</div><div className="v num accent">{cur.perKill != null ? n(cur.perKill) + " z" : "—"}</div><div className="note">{pctTag(vsAvg(cur.perKill, profAvg))}</div></div>
            <div className="stat"><div className="k">Média por semana</div><div className="v num">{profAvg != null ? n(profAvg) + " z" : "—"}</div></div>
            <div className="stat"><div className="k">Melhor semana</div><div className="v num">{bestProf?.perKill != null ? n(bestProf.perKill) + " z" : "—"}</div>{bestProf && <div className="note">até {fmtDate(bestProf.w)}</div>}</div>
          </div>
          <div className="panel"><BarChart bars={profBars} avg={profAvg} unit="zeny por kill" empty="Ainda não tem semana fechada com drops registrados. A primeira barra aparece na próxima entrada de KC." /></div>
          <p className="note">Valor dos drops registrados na semana (vendidos pelo preço da venda, divididos só a sua parte) ÷ (kills + participações como suporte) da semana. Elunium, Oridecon e ovos de captura ficam fora.</p>

          {(byMvp.length > 0 || byChar.length > 0) && (
            <>
              <h2>Semana atual ({dm(cur.prev)} → {dm(cur.w)}) em detalhe</h2>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
                {[{ t: "Por MVP", rows: byMvp, name: (k: string) => k, link: (k: string) => `/estatisticas?mvp=${encodeURIComponent(k)}${charF ? `&char=${charF}` : ""}` },
                  { t: "Por personagem", rows: byChar, name: (k: string) => charName.get(k) ?? k, link: (k: string) => `/estatisticas?char=${k}${mvpF ? `&mvp=${encodeURIComponent(mvpF)}` : ""}` }]
                  .filter((b) => b.rows.length > 0).map((b) => {
                    const max = Math.max(...b.rows.map((r) => Math.max(r.now, r.avg)), 1);
                    return (
                      <div key={b.t} className="panel">
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>{b.t}</div>
                        <div style={{ display: "grid", gap: 8 }}>
                          {b.rows.slice(0, 12).map((r) => {
                            const p = r.avg ? ((r.now - r.avg) / r.avg) * 100 : null;
                            return (
                              <div key={r.k}>
                                <div className="row" style={{ justifyContent: "space-between", fontSize: 13.5 }}>
                                  <Link href={b.link(r.k)}>{b.name(r.k)}</Link>
                                  <span className="num"><b>{n(r.now)}</b> <span className="dim">· média {n(r.avg)}</span> {p != null && <span className={p >= 0 ? "up" : "down"}>{p >= 0 ? "+" : ""}{Math.round(p)}%</span>}</span>
                                </div>
                                <div style={{ position: "relative", height: 8, background: "var(--panel-2)", borderRadius: 4, marginTop: 4 }}>
                                  <div style={{ width: `${(r.now / max) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 4 }} />
                                  <div title="média" style={{ position: "absolute", left: `${(r.avg / max) * 100}%`, top: -2, bottom: -2, width: 2, background: "var(--text)", opacity: 0.6 }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {b.rows.length > 12 && <p className="note" style={{ marginBottom: 0 }}>Mostrando os 12 com mais kills.</p>}
                      </div>
                    );
                  })}
              </div>
              <p className="note">Barra = kills na semana atual; risco = média semanal. Clique num nome para ver os gráficos só dele.</p>
            </>
          )}

          <h2>Itens enviados para projetos por semana</h2>
          <div className="stats">
            <div className="stat"><div className="k">Semana atual</div><div className="v num accent">{n(projVals[projVals.length - 1] ?? 0)}</div><div className="note">{pctTag(vsAvg(projVals[projVals.length - 1], projAvg))}</div></div>
            <div className="stat"><div className="k">Média por semana</div><div className="v num">{projAvg != null ? projAvg.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}</div></div>
            <div className="stat"><div className="k">Desde {dm(cur.w)}</div><div className="v num">{n(sentAfter)}</div><div className="note">entram na próxima semana</div></div>
          </div>
          <div className="panel"><BarChart bars={projBars} avg={projAvg} unit="itens enviados" empty="Nenhum item enviado para projetos ainda." /></div>
          {projects.length > 0 && (
            <div className="tbl" style={{ marginTop: 12 }}>
              <table>
                <thead><tr><th>Projeto</th><th className="r">Enviados</th><th className="r">Quebraram</th><th className="r">No projeto</th><th className="r">Até a média do site</th></tr></thead>
                <tbody>
                  {projects.map((p) => {
                    const u = projUnits.filter((x) => x.project_id === p.id);
                    const alive = u.filter((x) => x.status === "projeto").length;
                    const avgItems = 1 / chanceOne(p.item_type, 0, p.target_refine);
                    return (
                      <tr key={p.id}>
                        <td><Link href={`/projetos/${p.id}`}>{p.name}</Link>{p.status === "concluido" && <> <span className="pill">concluído</span></>}</td>
                        <td className="r num">{u.length}</td>
                        <td className="r num down">{u.filter((x) => x.status === "quebrou").length || "—"}</td>
                        <td className="r num">{alive}</td>
                        <td className="r num">{Math.round(Math.min(1, alive / avgItems) * 100)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <h2>Tabela</h2>
          <div className="tbl">
            <table>
              <thead><tr><th>Semana</th><th className="r">Kills</th><th className="r">Suporte</th><th className="r">Valor dos drops</th><th className="r">Zeny / kill</th></tr></thead>
              <tbody>
                {weeksData.slice().reverse().map((x) => (
                  <tr key={x.w}>
                    <td className="num">{fmtDate(x.prev)} → {fmtDate(x.w)}</td>
                    <td className="r num">{n(x.kills)}</td>
                    <td className="r num">{x.sup || <span className="dim">—</span>}</td>
                    <td className="r num">{x.perKill != null ? n(x.value) + " z" : <span className="dim">—</span>}</td>
                    <td className="r num">{x.perKill != null ? n(x.perKill) + " z" : <span className="dim">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
