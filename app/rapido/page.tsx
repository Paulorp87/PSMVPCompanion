import { q } from "@/lib/db";
import { getCharacters } from "@/lib/data";
import { STATIC_MVPS } from "@/lib/static-data";
import { STOCK_IDS } from "@/lib/stock";
import QuickDrop from "./QuickDrop";

export const dynamic = "force-dynamic";

export default async function Rapido({ searchParams }: { searchParams: Promise<{ char?: string; mvp?: string; suporte?: string }> }) {
  const sp = await searchParams;
  const [chars, kc, extra] = await Promise.all([
    getCharacters(),
    q<{ character_id: number; mvp: string; kills: number }>(
      `SELECT DISTINCT ON (character_id, mvp) character_id, mvp, kills FROM kc ORDER BY character_id, mvp, week DESC`),
    q<{ name: string; drops: { id: number; name: string; rate: number }[] | null }>("SELECT name, drops FROM mvps"),
  ]);
  const tables: Record<string, { id: number; name: string; rate: number }[]> = {};
  for (const r of extra) if (r.drops?.length) tables[r.name] = r.drops;
  for (const [n, m] of Object.entries(STATIC_MVPS)) if (m.drops.length) tables[n] = m.drops;
  for (const k of Object.keys(tables)) {
    // tira Elunium/Oridecon (controlados pelo estoque) e repetidos
    tables[k] = [...new Map(tables[k].filter((d) => !STOCK_IDS.includes(d.id)).map((d) => [d.id, d])).values()];
  }
  const byChar: Record<number, string[]> = {};
  for (const r of kc.sort((a, b) => b.kills - a.kills)) (byChar[r.character_id] ??= []).push(r.mvp);

  return (
    <>
      <h1>Drop rápido</h1>
      <p className="sub">Personagem → MVP → item. Três toques e o drop fica registrado. O destino padrão é "Sem status".</p>
      <QuickDrop
        chars={chars.filter((c) => c.sprite || byChar[c.id]).map((c) => ({ id: c.id, name: c.name, sprite: c.sprite, mvps: byChar[c.id] ?? [] }))}
        tables={tables}
        initialChar={sp.char ? Number(sp.char) : undefined}
        initialMvp={sp.mvp || undefined}
        initialSupport={sp.suporte ? Number(sp.suporte) : undefined}
      />
    </>
  );
}
