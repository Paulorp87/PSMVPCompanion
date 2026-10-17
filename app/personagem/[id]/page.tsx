import Link from "next/link";
import { notFound } from "next/navigation";
import { getCharacter, characterMvps, knownMvps, todayChicago } from "@/lib/data";
import { createCharacter, deleteCharacter } from "@/app/actions";
import KcForm from "./KcForm";

export const dynamic = "force-dynamic";

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
      <KcForm characterId={c.id} rows={rows} mvpNames={mvps} today={todayChicago()} />
      <form action={deleteCharacter} style={{ marginTop: 36 }}>
        <input type="hidden" name="id" value={c.id} />
        <button className="btn ghost small" formNoValidate>Remover personagem</button>
        <span className="note"> Apaga o personagem e todo o KC dele.</span>
      </form>
    </>
  );
}
