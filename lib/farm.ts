import { q } from "./db";

export type FarmMob = { id: number; name: string; level: number; hp: number; base_exp: number; job_exp: number; is_mvp: boolean; amount: number; drops: [number, string, number][] };
export type MapInfo = { map_id: string; map_name: string; mobs: string[] };
export type Loot = { id: number; name: string; price: number | null; source: string | null; from: { mob: string; rate: number }[] };

// Consumíveis mais comuns (preço da Price Check quando tiver, sempre editável).
export const CONSUMABLES: { id: number; name: string }[] = [
  { id: 601, name: "Fly Wing" }, { id: 602, name: "Butterfly Wing" }, { id: 536, name: "Ice Cream" },
  { id: 501, name: "Red Potion" }, { id: 502, name: "Orange Potion" }, { id: 503, name: "Yellow Potion" },
  { id: 504, name: "White Potion" }, { id: 505, name: "Blue Potion" }, { id: 545, name: "Condensed Red Potion" },
  { id: 546, name: "Condensed Yellow Potion" }, { id: 547, name: "Condensed White Potion" },
  { id: 645, name: "Concentration Potion" }, { id: 656, name: "Awakening Potion" }, { id: 657, name: "Berserk Potion" },
  { id: 607, name: "Yggdrasil Berry" }, { id: 608, name: "Yggdrasil Seed" }, { id: 526, name: "Royal Jelly" },
  { id: 715, name: "Yellow Gemstone" }, { id: 716, name: "Red Gemstone" }, { id: 717, name: "Blue Gemstone" },
  { id: 1065, name: "Trap" },
];

export const DESTS = ["vender", "guardar", "loja"] as const;
export type Dest = (typeof DESTS)[number];
export const DEST_LABEL: Record<Dest, string> = { vender: "Vendi", guardar: "Guardar", loja: "Lojinha" };

export async function listMaps(): Promise<MapInfo[]> {
  return q<MapInfo>(
    `SELECT s->>0 AS map_id, MIN(s->>1) AS map_name, array_agg(DISTINCT m.name ORDER BY m.name) AS mobs
     FROM ps_mobs m, jsonb_array_elements(m.spawns) s
     WHERE NOT m.is_mvp GROUP BY s->>0 ORDER BY MIN(s->>1), s->>0`);
}

export async function mapMobs(mapId: string): Promise<{ name: string | null; mobs: FarmMob[] }> {
  const mobs = await q<FarmMob & { map_name: string }>(
    `SELECT m.id, m.name, m.level, m.hp::float8 AS hp, m.base_exp::float8 AS base_exp, m.job_exp::float8 AS job_exp, m.is_mvp,
            SUM((s->>2)::int)::int AS amount, m.drops, MIN(s->>1) AS map_name
     FROM ps_mobs m, jsonb_array_elements(m.spawns) s
     WHERE s->>0 = $1 GROUP BY m.id ORDER BY m.is_mvp, SUM((s->>2)::int) DESC, m.name`, [mapId]);
  return { name: mobs[0]?.map_name ?? null, mobs };
}

/** Todos os loots dos monstros (não-MVP) do mapa, com quem dropa e o preço de mercado. */
export async function mapLoot(mobs: FarmMob[]): Promise<Loot[]> {
  const by = new Map<number, Loot>();
  for (const m of mobs) {
    if (m.is_mvp) continue;
    for (const [id, name, rate] of m.drops) {
      const l = by.get(id) ?? { id, name, price: null, source: null, from: [] };
      l.from.push({ mob: m.name, rate });
      by.set(id, l);
    }
  }
  const ids = [...by.keys()];
  if (ids.length) {
    const ps = await q<{ item_id: number; price: number | null; source: string }>(
      "SELECT item_id, price::float8 AS price, source FROM prices WHERE item_id = ANY($1)", [ids]);
    for (const p of ps) { const l = by.get(p.item_id)!; l.price = p.price; l.source = p.source; }
  }
  // mais provável primeiro
  return [...by.values()].sort((a, b) => Math.max(...b.from.map((f) => f.rate)) - Math.max(...a.from.map((f) => f.rate)));
}

export type SessionCalc = {
  sold: number; stored: number; shopSold: number; shopOpen: number; costs: number;
  real: number; potential: number; realPer5: number; potPer5: number;
};

/** Lucro real = vendido (na hora + o que já vendeu da lojinha) − consumíveis.
 *  Potencial = vendido + guardado + lojinha (vendido pelo preço da venda, o resto pelo preço de mercado) − consumíveis. */
export async function calcSessions(ids: number[]): Promise<Map<number, SessionCalc>> {
  const out = new Map<number, SessionCalc>();
  if (!ids.length) return out;
  const [sess, items, costs, shop] = await Promise.all([
    q<{ id: number; minutes: number }>("SELECT id, minutes FROM farm_sessions WHERE id = ANY($1)", [ids]),
    q<{ session_id: number; item_id: number; qty: number; dest: Dest; price: number | null }>(
      "SELECT session_id, item_id, qty, dest, price::float8 AS price FROM farm_items WHERE session_id = ANY($1)", [ids]),
    q<{ session_id: number; v: number }>("SELECT session_id, SUM(qty*price)::float8 AS v FROM farm_costs WHERE session_id = ANY($1) GROUP BY session_id", [ids]),
    q<{ farm_session_id: number; item_id: number; qty: number; status: string; sold_price: number | null; split: number }>(
      "SELECT farm_session_id, item_id, qty, status, sold_price::float8 AS sold_price, split FROM drops WHERE farm_session_id = ANY($1)", [ids]),
  ]);
  for (const s of sess) {
    const its = items.filter((i) => i.session_id === s.id);
    const priceOf = (id: number) => its.find((i) => i.item_id === id)?.price ?? 0;
    const sold = its.filter((i) => i.dest === "vender").reduce((a, i) => a + i.qty * (i.price ?? 0), 0);
    const stored = its.filter((i) => i.dest === "guardar").reduce((a, i) => a + i.qty * (i.price ?? 0), 0);
    let shopSold = 0, shopOpen = 0;
    for (const d of shop.filter((d) => d.farm_session_id === s.id)) {
      if (d.status === "vendido" && d.sold_price != null) shopSold += (d.qty * d.sold_price) / (d.split || 1);
      else if (d.status !== "quebrou" && d.status !== "usado") shopOpen += d.qty * priceOf(d.item_id);
    }
    const c = costs.find((x) => x.session_id === s.id)?.v ?? 0;
    const real = sold + shopSold - c;
    const potential = sold + stored + shopSold + shopOpen - c;
    const k = s.minutes / 5;
    out.set(s.id, { sold, stored, shopSold, shopOpen, costs: c, real, potential, realPer5: real / k, potPer5: potential / k });
  }
  return out;
}
