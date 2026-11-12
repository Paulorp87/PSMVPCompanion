import { q } from "./db";

export const HERB = { id: 510, name: "Blue Herb" };

export type HerbDay = { day: string; qty: number; goal: number; at: number };
export type HerbBuy = { id: number; day: string; qty: number; price: number; at: number };
export type HerbBrew = { id: number; day: string; used: number; potions: number; at: number };
export type HerbInfo = {
  goal: number; price: number; days: HerbDay[]; buys: HerbBuy[]; brews: HerbBrew[];
  stock: number; stockBase: { day: string; qty: number; at: number } | null;
  total: number; hit: number;
  bought: number; spent: number; used: number; potions: number; rate: number | null;
};

/** Estoque = estoque inicial/última contagem + farmado + comprado − usado em poção (tudo que foi lançado depois da contagem). */
export async function herbInfo(): Promise<HerbInfo> {
  const [set, days, buys, brews, base] = await Promise.all([
    q<{ goal: number; price: number }>("SELECT goal, price FROM herb_settings WHERE id=1"),
    q<HerbDay>("SELECT to_char(day,'YYYY-MM-DD') AS day, qty, goal, extract(epoch from created_at)::float8 AS at FROM herb_days ORDER BY day"),
    q<HerbBuy>("SELECT id, to_char(day,'YYYY-MM-DD') AS day, qty, price::float8 AS price, extract(epoch from created_at)::float8 AS at FROM herb_buys ORDER BY day, id"),
    q<HerbBrew>("SELECT id, to_char(day,'YYYY-MM-DD') AS day, used, potions, extract(epoch from created_at)::float8 AS at FROM herb_brews ORDER BY day, id"),
    q<{ day: string; qty: number; at: number }>("SELECT to_char(day,'YYYY-MM-DD') AS day, qty, extract(epoch from created_at)::float8 AS at FROM herb_stock ORDER BY created_at DESC LIMIT 1"),
  ]);
  const b = base[0] ?? null;
  // compara pelo momento em que foi lançado
  const after = (at: number) => !b || at > b.at;
  const stock = (b?.qty ?? 0)
    + days.filter((d) => after(d.at)).reduce((a, d) => a + d.qty, 0)
    + buys.filter((d) => after(d.at)).reduce((a, d) => a + d.qty, 0)
    - brews.filter((d) => after(d.at)).reduce((a, d) => a + d.used, 0);
  const used = brews.reduce((a, d) => a + d.used, 0);
  const potions = brews.reduce((a, d) => a + d.potions, 0);
  return {
    goal: set[0]?.goal ?? 0, price: set[0]?.price ?? 1300, days, buys, brews,
    stock, stockBase: b,
    total: days.reduce((a, d) => a + d.qty, 0),
    hit: days.filter((d) => d.goal > 0 && d.qty >= d.goal).length,
    bought: buys.reduce((a, d) => a + d.qty, 0),
    spent: buys.reduce((a, d) => a + d.qty * d.price, 0),
    used, potions, rate: used ? potions / used : null,
  };
}
