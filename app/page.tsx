import Link from "next/link";
import { getCharacters, getWeeks, totalsByCharacter, fmtDate } from "@/lib/data";

export const dynamic = "force-dynamic";
const n = (x: number) => x.toLocaleString("pt-BR");

export default async function Home() {
  const [chars, weeks] = await Promise.all([getCharacters(), getWeeks()]);
  const last = weeks[0], prev = weeks[1];
  const now = last ? await totalsByCharacter(last) : new Map<number, number>();
  const before = prev ? await totalsByCharacter(prev) : new Map<number, number>();
  const total = [...now.values()].reduce((a, b) => a + b, 0);
  const totalPrev = [...before.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <h1>Personagens</h1>
      <p className="sub">Clique num personagem para atualizar o KC dele.</p>

      <div className="stats">
        <div className="stat"><div className="k">Total geral{last ? ` (até ${fmtDate(last)})` : ""}</div><div className="v accent num">{n(total)}</div></div>
        {prev && <div className="stat"><div className="k">Semana ({fmtDate(prev)} → {fmtDate(last)})</div><div className="v num up">+{n(total - totalPrev)}</div></div>}
        <div className="stat"><div className="k">Personagens com KC</div><div className="v num">{now.size}</div></div>
      </div>

      <h2>Seus personagens</h2>
      <div className="grid">
        {chars.map((c) => {
          const t = now.get(c.id) ?? 0;
          const d = t - (before.get(c.id) ?? 0);
          return (
            <Link key={c.id} href={`/personagem/${c.id}`} className={`char${t ? "" : " empty"}`}>
              <div className="art">{c.sprite ? <img src={c.sprite} alt="" /> : <span className="none">＋</span>}</div>
              <div className="nm" title={c.name}>{c.name}</div>
              <div className="kc num">
                {t ? <><b>{n(t)}</b> {t === 1 ? "kill" : "kills"}{prev && d > 0 && <span className="up"> · +{n(d)}</span>}</> : "sem KC"}
              </div>
            </Link>
          );
        })}
      </div>
      <p className="note" style={{ marginTop: 16 }}>Personagem novo? Adicione pela página <Link href="/personagem/novo">Novo personagem</Link>.</p>
    </>
  );
}
