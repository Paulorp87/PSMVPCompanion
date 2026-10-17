import { q } from "@/lib/db";
import { getCharacters, knownMvps, todayChicago, fmtDate } from "@/lib/data";
import { deleteDrop } from "@/app/actions";
import DropForm from "./DropForm";

export const dynamic = "force-dynamic";

type Row = { id: number; dropped_on: string; mvp: string; item_id: number; item_name: string; qty: number; char: string | null };

export default async function Drops({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string; mvp?: string }> }) {
  const sp = await searchParams;
  const [mvps, chars, rows] = await Promise.all([
    knownMvps(),
    getCharacters(),
    q<Row>(`SELECT d.id, to_char(d.dropped_on,'YYYY-MM-DD') AS dropped_on, d.mvp, d.item_id, d.item_name, d.qty, c.name AS char
            FROM drops d LEFT JOIN characters c ON c.id=d.character_id ORDER BY d.dropped_on DESC, d.id DESC LIMIT 100`),
  ]);
  return (
    <>
      <h1>Drops</h1>
      <p className="sub">Registre o que caiu de cada MVP. Os itens de cada MVP vêm do Payon Stories Tools.</p>
      {sp.ok && <p className="flash">Drop registrado.</p>}
      {sp.e && <p className="flash err">Faltou escolher o MVP ou o item.</p>}
      <DropForm mvps={mvps} chars={chars.map((c) => ({ id: c.id, name: c.name }))} today={todayChicago()} initialMvp={sp.mvp} />

      <h2>Últimos drops</h2>
      {rows.length === 0 ? <p className="note">Nenhum drop registrado ainda.</p> : (
        <div className="tbl">
          <table>
            <thead><tr><th>Data</th><th>MVP</th><th>Item</th><th className="r">Qtd</th><th>Personagem</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="num">{fmtDate(r.dropped_on)}</td>
                  <td>{r.mvp}</td>
                  <td>{r.item_name} <span className="dim">#{r.item_id}</span></td>
                  <td className="r num">{r.qty}</td>
                  <td className="dim">{r.char ?? "—"}</td>
                  <td className="r">
                    <form action={deleteDrop}><input type="hidden" name="id" value={r.id} /><button className="btn ghost small" title="Apagar">✕</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
