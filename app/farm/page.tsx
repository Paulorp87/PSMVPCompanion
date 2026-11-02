import Link from "next/link";
import { q } from "@/lib/db";
import { listMaps, calcSessions } from "@/lib/farm";
import { fmtDate, getCharacters } from "@/lib/data";
import MapPicker from "./MapPicker";

export const dynamic = "force-dynamic";
const n = (v: number) => Math.round(v).toLocaleString("pt-BR");

export default async function Farm() {
  const [maps, sessions, upd, allChars] = await Promise.all([
    listMaps(),
    q<{ id: number; day: string; map_id: string; map_name: string; build: string; minutes: number }>(
      `SELECT s.id, to_char(s.day,'YYYY-MM-DD') AS day, s.map_id, s.map_name, COALESCE(c.name, s.build) AS build, s.minutes
       FROM farm_sessions s LEFT JOIN characters c ON c.id=s.character_id ORDER BY s.day DESC, s.id DESC`),
    q<{ d: string | null }>("SELECT to_char(MAX(updated_at) AT TIME ZONE 'America/Chicago','YYYY-MM-DD') AS d FROM ps_mobs"),
    getCharacters(),
  ]);
  const chars = allChars.filter((c) => c.sprite);
  const calc = await calcSessions(sessions.map((s) => s.id));
  const recent = [...new Map(sessions.map((s) => [s.map_id, { map_id: s.map_id, map_name: s.map_name }])).values()].slice(0, 6);

  // comparação por mapa + build
  const groups = new Map<string, { map: string; build: string; n: number; min: number; real: number; pot: number }>();
  for (const s of sessions) {
    const c = calc.get(s.id)!; const k = `${s.map_id}|${s.build.toLowerCase()}`;
    const g = groups.get(k) ?? { map: s.map_name, build: s.build, n: 0, min: 0, real: 0, pot: 0 };
    g.n++; g.min += s.minutes; g.real += c.real; g.pot += c.potential;
    groups.set(k, g);
  }
  const cmp = [...groups.values()].sort((a, b) => b.pot / b.min - a.pot / a.min);

  return (
    <>
      <h1>Farm</h1>
      <p className="sub">Escolha o mapa e o personagem, marque o que caiu e o que fez com cada item. No fim sai o lucro real (o que vendeu), o valor potencial (vendido + guardado + lojinha) e quanto rende a cada 5 minutos.</p>
      {maps.length === 0
        ? <p className="flash err">Os monstros do Payon Stories ainda não foram carregados. Peça pro Claude puxar o monster database.</p>
        : <MapPicker maps={maps} chars={chars} recent={recent} />}
      {upd[0]?.d && <p className="note">{maps.length} mapas · monstros puxados do Payon Stories em {fmtDate(upd[0].d)}.</p>}

      {cmp.length > 0 && (
        <>
          <h2>Comparação por mapa e personagem</h2>
          <div className="tbl"><table>
            <thead><tr><th>Mapa</th><th>Personagem</th><th className="r">Sessões</th><th className="r">Tempo</th><th className="r">Real / 5 min</th><th className="r">Potencial / 5 min</th></tr></thead>
            <tbody>{cmp.map((g) => (
              <tr key={g.map + g.build}><td>{g.map}</td><td>{g.build}</td><td className="r num">{g.n}</td><td className="r num">{n(g.min)} min</td>
                <td className="r num">{n(g.real / (g.min / 5))}</td><td className="r num up">{n(g.pot / (g.min / 5))}</td></tr>
            ))}</tbody>
          </table></div>
        </>
      )}

      {sessions.length > 0 && (
        <>
          <h2>Sessões</h2>
          <div className="tbl"><table>
            <thead><tr><th>Data</th><th>Mapa · personagem</th><th className="r">Tempo</th><th className="r">Lucro real</th><th className="r">Potencial</th><th className="r">Real / 5 min</th><th className="r">Potencial / 5 min</th></tr></thead>
            <tbody>{sessions.map((s) => { const c = calc.get(s.id)!; return (
              <tr key={s.id}>
                <td className="num"><Link href={`/farm/${s.id}`}>{fmtDate(s.day)}</Link></td>
                <td><Link href={`/farm/${s.id}`}>{s.map_name}</Link><div className="dim" style={{ fontSize: 12 }}>{s.build}</div></td>
                <td className="r num">{s.minutes} min</td>
                <td className={`r num ${c.real < 0 ? "down" : ""}`}>{n(c.real)}</td>
                <td className="r num">{n(c.potential)}</td>
                <td className="r num">{n(c.realPer5)}</td>
                <td className="r num up">{n(c.potPer5)}</td>
              </tr>); })}</tbody>
          </table></div>
        </>
      )}
    </>
  );
}
