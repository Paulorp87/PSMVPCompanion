// Dados puxados do tools.payonstories.com pelo Claude (a Cloudflare do site bloqueia a Vercel).
// Para atualizar: regenerar data/*.json e fazer deploy.
import drops from "@/data/mvp-drops.json";
import prices from "@/data/prices.json";

export type StaticDrop = { id: number; name: string; rate: number };
export const STATIC_MVPS = drops as Record<string, { mob_id: number | null; drops: StaticDrop[] }>;

export type StaticPrice = { name: string; price: number | null; samples: number; source: string };
export const STATIC_PRICES = prices as { updated: string; method: string; items: Record<string, StaticPrice> };
