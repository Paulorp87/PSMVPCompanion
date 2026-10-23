import Link from "next/link";
import { notFound } from "next/navigation";
import { getCharacter, characterMvps, knownMvps, todayChicago } from "@/lib/data";
import { createCharacter, deleteCharacter } from "@/app/actions";
import KcForm from "./KcForm";
import HistoryForm from "./HistoryForm";
import { q } from "@/lib/db";
import { mvpInfoMany } from "@/lib/ps";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Personagem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (id === "novo") {
    return (
      <>
        <p><Link href="/" className="dim">← Personagens</Link></p>
        <h1>Novo personagem</h1>
        <form action={createCharacter} className="panel row" style={{ marginTop: 12 }}>
          <label className="f" style={{ flex: 1 }}>Nome<input name="name" required autoFocus /></label>
          <button className="btn">Criar</button>
        </form>
      </>
    );
  }

  const c = await getCharacter(Number(id));
  if (!c) notFound();
  const [rows, mvps] = await Promise.all([characterMvps(c.id), knownMvps()]);
  const [info, hist, flags] = await Promise.all([
    mvpInfoMany(rows.map((r) => r.mvp)),
    q<{ mvp: string; item_id: number; item_name: string; qty: number }>("SELECT mvp, item_id, item_name, qty FROM history WHERE character_id=$1", [c.id]),
    q<{ mvp: string; complete: boolean }>("SELECT mvp, complete FROM history_flag WHERE character_id=$1", [c.id]),
  ]);
  const flag = new Map(flags.map((f) => [f.mvp, f.complete]));
  const sup = await q<{ mvp: string; n: number }>("SELECT mvp, count(*)::int AS n FROM support WHERE character_id=$1 GROUP BY mvp", [c.id]);
  const supMap = Object.fromEntries(sup.map((s) => [s.mvp, s.n]));
  // MVPs onde só foi suporte (sem KC) também aparecem na tabela
  for (const s of sup) if (!rows.some((r) => r.mvp === s.mvp)) rows.push({ mvp: s.mvp, kills: 0, week: todayChicago() });

  return (
    <>
      <p><Link href="/" className="dim">← Personagens</Link></p>
      <div className="charhead">
        {c.sprite && <img src={c.sprite} alt="" />}
        <div>
          <h1>{c.name}</h1>
          <p className="sub" style={{ margin: 0 }}>
            Digite só o KC que mudou. Os campos vazios continuam com o último valor.
          </p>
        </div>
      </div>
      <KcForm characterId={c.id} rows={rows} mvpNames={mvps} today={todayChicago()} support={supMap} />
      {rows.some((r) => r.kills > 0) && (
        <>
          <h2>Drops até hoje</h2>
          <p className="sub" style={{ marginBottom: 10 }}>
            Quantos de cada item já caíram neste personagem. Vale a pena principalmente para quem só caça um MVP.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {rows.filter((r) => r.kills > 0).map((r) => (
              <HistoryForm key={r.mvp} characterId={c.id} mvp={r.mvp} kills={r.kills}
                drops={info.get(r.mvp)?.drops ?? []} loadError={!info.get(r.mvp)}
                saved={hist.filter((h) => h.mvp === r.mvp)} complete={flag.get(r.mvp) ?? false}
                open={rows.length === 1} />
            ))}
          </div>
        </>
      )}
      <form action={deleteCharacter} style={{ marginTop: 36 }}>
        <input type="hidden" name="id" value={c.id} />
        <button className="btn ghost small" formNoValidate>Remover personagem</button>
        <span className="note"> Apaga o personagem e todo o KC dele.</span>
      </form>
    </>
  );
}
