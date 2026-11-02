import Link from "next/link";
import { q } from "@/lib/db";
import { mapMobs, mapLoot, CONSUMABLES } from "@/lib/farm";
import { todayChicago } from "@/lib/data";
import FarmForm from "./FarmForm";

export const dynamic = "force-dynamic";

export default async function NovaSessao({ searchParams }: { searchParams: Promise<{ map?: string; build?: string }> }) {
  const sp = await searchParams;
  const mapId = sp.map ?? "";
  const { name, mobs } = await mapMobs(mapId);
  if (!name) return <><h1>Farm</h1><p className="flash err">Mapa não encontrado. <Link href="/farm">Voltar</Link></p></>;
  const loot = await mapLoot(mobs);
  const cp = await q<{ item_id: number; price: number }>("SELECT item_id, price::float8 AS price FROM prices WHERE item_id = ANY($1)", [CONSUMABLES.map((c) => c.id)]);
  const consumables = CONSUMABLES.map((c) => ({ ...c, price: cp.find((p) => p.item_id === c.id)?.price ?? null }));

  return (
    <>
      <p className="note"><Link href="/farm">← Farm</Link></p>
      <h1>{name} <span className="dim" style={{ fontSize: 16 }}>{mapId}</span></h1>
      <p className="sub">{sp.build}</p>
      <div className="tbl"><table>
        <thead><tr><th>Monstro</th><th className="r">Lv</th><th className="r">HP</th><th className="r">Base / Job EXP</th><th className="r">Qtd no mapa</th></tr></thead>
        <tbody>{mobs.map((m) => (
          <tr key={m.id}><td>{m.name}{m.is_mvp && <span className="pill" style={{ marginLeft: 6 }}>MVP</span>}</td><td className="r num">{m.level}</td>
            <td className="r num">{Math.round(m.hp).toLocaleString("pt-BR")}</td>
            <td className="r num">{Math.round(m.base_exp).toLocaleString("pt-BR")} / {Math.round(m.job_exp).toLocaleString("pt-BR")}</td>
            <td className="r num">{m.amount}</td></tr>
        ))}</tbody>
      </table></div>
      {mobs.some((m) => m.is_mvp) && <p className="note">Os drops de MVP ficam fora da lista; MVP você registra no Drop rápido.</p>}
      <FarmForm mapId={mapId} mapName={name} build={sp.build ?? ""} today={todayChicago()} loot={loot} consumables={consumables} />
    </>
  );
}
