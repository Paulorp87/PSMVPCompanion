import Link from "next/link";
import { notFound } from "next/navigation";
import { q } from "@/lib/db";
import { calcSessions, DEST_LABEL, type Dest } from "@/lib/farm";
import { fmtDate } from "@/lib/data";
import { STATUS_LABEL, type Status } from "@/lib/status";
import { deleteFarmSession } from "@/app/actions";

export const dynamic = "force-dynamic";
const n = (v: number) => Math.round(v).toLocaleString("pt-BR");

export default async function Sessao({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const s = (await q<{ id: number; day: string; map_id: string; map_name: string; build: string; minutes: number }>(
    "SELECT id, to_char(day,'YYYY-MM-DD') AS day, map_id, map_name, build, minutes FROM farm_sessions WHERE id=$1", [id]))[0];
  if (!s) notFound();
  const [items, costs, shop, calc] = await Promise.all([
    q<{ item_id: number; item_name: string; qty: number; dest: Dest; price: number | null }>(
      "SELECT item_id, item_name, qty, dest, price::float8 AS price FROM farm_items WHERE session_id=$1 ORDER BY dest, qty*COALESCE(price,0) DESC", [id]),
    q<{ item_name: string; qty: number; price: number }>("SELECT item_name, qty, price::float8 AS price FROM farm_costs WHERE session_id=$1 ORDER BY id", [id]),
    q<{ item_id: number; item_name: string; qty: number; status: Status; sold_price: number | null }>(
      "SELECT item_id, item_name, qty, status, sold_price::float8 AS sold_price FROM drops WHERE farm_session_id=$1 ORDER BY item_name", [id]),
    calcSessions([id]),
  ]);
  const c = calc.get(id)!;
  const per = s.minutes / 5;

  return (
    <>
      <p className="note"><Link href="/farm">← Farm</Link></p>
      <h1>{s.map_name} <span className="dim" style={{ fontSize: 16 }}>{s.map_id}</span></h1>
      <p className="sub">{s.build} · {fmtDate(s.day)} · {s.minutes} min</p>
      <div className="stats">
        <div className="stat"><div className="k">Lucro real</div><div className={`v num ${c.real < 0 ? "down" : ""}`}>{n(c.real)} z</div><div className="note num">{n(c.real / per)} z / 5 min</div></div>
        <div className="stat"><div className="k">Valor potencial</div><div className="v num accent">{n(c.potential)} z</div><div className="note num">{n(c.potential / per)} z / 5 min</div></div>
        <div className="stat"><div className="k">Lojinha</div><div className="v num" style={{ fontSize: 16 }}>{n(c.shopSold)} vendido</div><div className="note num">{n(c.shopOpen)} ainda na loja (estimado)</div></div>
        <div className="stat"><div className="k">Consumíveis</div><div className="v num down" style={{ fontSize: 16 }}>−{n(c.costs)} z</div></div>
      </div>

      <h2>Itens</h2>
      <div className="tbl"><table>
        <thead><tr><th>Item</th><th className="r">Qtd</th><th>Destino</th><th className="r">Preço un.</th><th className="r">Total</th></tr></thead>
        <tbody>{items.map((i, k) => (
          <tr key={k}><td>{i.item_name} {i.item_id > 0 && <span className="dim">#{i.item_id}</span>}</td><td className="r num">{i.qty}</td>
            <td>{DEST_LABEL[i.dest]}</td><td className="r num">{i.price != null ? n(i.price) : "—"}</td><td className="r num">{n(i.qty * (i.price ?? 0))}</td></tr>
        ))}</tbody>
      </table></div>

      {shop.length > 0 && (
        <>
          <h2>Na lojinha</h2>
          <p className="note">Esses itens estão na página <Link href="/drops?status=todos">Drops</Link>. Quando marcar como Vendido lá com o preço, ele entra aqui como lucro real.</p>
          <div className="tbl"><table>
            <thead><tr><th>Item</th><th className="r">Qtd</th><th>Status</th><th className="r">Vendido por</th></tr></thead>
            <tbody>{shop.map((d, k) => (
              <tr key={k}><td>{d.item_name}</td><td className="r num">{d.qty}</td><td>{STATUS_LABEL[d.status] ?? d.status}</td>
                <td className="r num">{d.sold_price != null ? n(d.sold_price) : "—"}</td></tr>
            ))}</tbody>
          </table></div>
        </>
      )}

      {costs.length > 0 && (
        <>
          <h2>Consumíveis</h2>
          <div className="tbl"><table>
            <thead><tr><th>Item</th><th className="r">Qtd</th><th className="r">Preço un.</th><th className="r">Total</th></tr></thead>
            <tbody>{costs.map((x, k) => <tr key={k}><td>{x.item_name}</td><td className="r num">{x.qty}</td><td className="r num">{n(x.price)}</td><td className="r num">{n(x.qty * x.price)}</td></tr>)}</tbody>
          </table></div>
        </>
      )}

      <form action={deleteFarmSession} style={{ marginTop: 24 }}>
        <input type="hidden" name="id" value={s.id} />
        <button className="btn small ghost">Apagar sessão</button>
        <span className="note"> apaga também os itens dela que estão na lojinha</span>
      </form>
    </>
  );
}
