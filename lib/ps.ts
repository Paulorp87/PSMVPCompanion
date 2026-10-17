// Cliente das rotas públicas do tools.payonstories.com (não documentadas).
import { q } from "./db";
import { STATIC_MVPS } from "./static-data";

const BASE = "https://tools.payonstories.com";
const WEEK_MS = 7 * 24 * 3600 * 1000;
export const SALES_SAMPLE = 10;

async function getJSON(path: string): Promise<any> {
  const r = await fetch(BASE + path, {
    headers: { Accept: "application/json", "User-Agent": "mvp-kc-tracker (uso pessoal, 1x/semana)" },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.json();
}

export type Drop = { id: number; name: string; rate: number };
export type MvpInfo = { name: string; mob_id: number | null; drops: Drop[] };

/** Acha o MVP pelo nome e guarda id + lista de drops (atualiza 1x/semana). */
export async function mvpInfo(name: string, force = false): Promise<MvpInfo> {
  const cached = await q<{ mob_id: number | null; drops: Drop[] | null; fetched_at: Date | null }>(
    "SELECT mob_id, drops, fetched_at FROM mvps WHERE lower(name)=lower($1)", [name]);
  const c = cached[0];
  const st = STATIC_MVPS[name];
  if (st && !force && (!c?.mob_id || c.mob_id === st.mob_id)) return { name, mob_id: st.mob_id, drops: st.drops };
  if (c && c.drops && c.fetched_at && !force && Date.now() - c.fetched_at.getTime() < WEEK_MS) {
    return { name, mob_id: c.mob_id, drops: c.drops };
  }
  try {
    let mobId = c?.mob_id ?? null;
    if (!mobId) {
      const s = await getJSON(`/api/db/search?mode=mobs_filter&q=${encodeURIComponent(name)}`);
      const mobs: any[] = s?.mobs ?? [];
      const exact = mobs.filter((m) => String(m.name).toLowerCase() === name.toLowerCase());
      const pick = exact.find((m) => m.isMvp) ?? exact[0] ?? mobs.find((m) => m.isMvp);
      mobId = pick ? Number(pick.id) : null;
    }
    let drops: Drop[] = [];
    if (mobId) {
      const e = await getJSON(`/api/db/entity?type=mob&id=${mobId}`);
      drops = (e?.data?.drops ?? []).map((d: any) => ({ id: Number(d.id), name: String(d.name), rate: Number(d.rate) }));
    }
    await q(
      `INSERT INTO mvps(name, mob_id, drops, fetched_at) VALUES ($1,$2,$3,now())
       ON CONFLICT (name) DO UPDATE SET mob_id=EXCLUDED.mob_id, drops=EXCLUDED.drops, fetched_at=now()`,
      [name, mobId, JSON.stringify(drops)]);
    return { name, mob_id: mobId, drops };
  } catch (err) {
    if (c?.drops) return { name, mob_id: c.mob_id, drops: c.drops };
    throw err;
  }
}

/** Corrige manualmente o ID do monstro de um MVP e recarrega a tabela de drops. */
export async function setMobId(name: string, mobId: number): Promise<MvpInfo> {
  await q(
    `INSERT INTO mvps(name, mob_id, drops, fetched_at) VALUES ($1,$2,NULL,NULL)
     ON CONFLICT (name) DO UPDATE SET mob_id=EXCLUDED.mob_id, drops=NULL, fetched_at=NULL`, [name, mobId]);
  return mvpInfo(name, true);
}

/** Carrega a tabela de drops de vários MVPs, poucos por vez. */
export async function mvpInfoMany(names: string[], concurrency = 4): Promise<Map<string, MvpInfo | null>> {
  const out = new Map<string, MvpInfo | null>();
  let i = 0;
  async function worker() {
    while (i < names.length) {
      const n = names[i++];
      try { out.set(n, await mvpInfo(n)); } catch { out.set(n, null); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, names.length) }, worker));
  return out;
}

export type Price = { item_id: number; price: number | null; samples: number; source: string; fetched_at: Date };

/** Média das últimas vendas (item sem refino e sem carta); se não houver, preço de NPC. */
async function fetchPrice(itemId: number): Promise<{ price: number | null; samples: number; source: string; name?: string }> {
  const h = await getJSON(`/api/pc/history?id=${itemId}`);
  const days: any[] = [...(h?.vendHistory ?? [])].sort((a, b) => String(b.x).localeCompare(String(a.x)));
  const pure: number[] = [], any: number[] = [];
  for (const d of days) {
    const ys: number[] = d.y ?? [];
    const fs: any[] = d.filter ?? [];
    ys.forEach((p, i) => {
      const f = fs[i];
      any.push(Number(p));
      if (!f || (!f.r && !f.c0 && !f.c1 && !f.c2 && !f.c3)) pure.push(Number(p));
    });
  }
  const pick = (pure.length ? pure : any).slice(0, SALES_SAMPLE);
  if (pick.length) {
    return { price: pick.reduce((a, b) => a + b, 0) / pick.length, samples: pick.length, source: pure.length ? "vendas" : "vendas (com refino/carta)" };
  }
  const e = await getJSON(`/api/db/entity?type=item&id=${itemId}`);
  const npc = e?.data?.sellPrice;
  return { price: npc != null ? Number(npc) : null, samples: 0, source: "NPC", name: e?.data?.name };
}

/** Atualiza os preços que estão sem valor ou com mais de 7 dias. */
export async function refreshPrices(items: { id: number; name: string }[], force = false): Promise<{ updated: number; failed: number }> {
  const have = await q<{ item_id: number; fetched_at: Date }>(
    "SELECT item_id, fetched_at FROM prices WHERE item_id = ANY($1::int[])", [items.map((i) => i.id)]);
  const age = new Map(have.map((h) => [h.item_id, h.fetched_at.getTime()]));
  let updated = 0, failed = 0;
  for (const it of items) {
    const t = age.get(it.id);
    if (!force && t && Date.now() - t < WEEK_MS) continue;
    try {
      const p = await fetchPrice(it.id);
      await q(
        `INSERT INTO prices(item_id, name, price, samples, source, fetched_at) VALUES ($1,$2,$3,$4,$5,now())
         ON CONFLICT (item_id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price, samples=EXCLUDED.samples,
           source=EXCLUDED.source, fetched_at=now()`,
        [it.id, it.name, p.price, p.samples, p.source]);
      updated++;
    } catch {
      failed++;
    }
  }
  return { updated, failed };
}
