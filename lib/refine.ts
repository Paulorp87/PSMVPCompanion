// Taxas de refino (pré-renovação / rAthena). Arma Nv4 e Armadura conferidas na Refine Calculator do Payon Stories.
export type ItemType = "w1" | "w2" | "w3" | "w4" | "armor";

export const ITEM_TYPES: Record<ItemType, { label: string; ore: { id: number; name: string }; fee: number; rates: number[] }> = {
  // rates[k] = chance de ir de +k para +(k+1)
  w1: { label: "Arma Nv 1", ore: { id: 1010, name: "Phracon" }, fee: 50, rates: [1, 1, 1, 1, 1, 1, 1, 0.6, 0.4, 0.19] },
  w2: { label: "Arma Nv 2", ore: { id: 1011, name: "Emveretarcon" }, fee: 200, rates: [1, 1, 1, 1, 1, 1, 0.6, 0.4, 0.2, 0.19] },
  w3: { label: "Arma Nv 3", ore: { id: 984, name: "Oridecon" }, fee: 5000, rates: [1, 1, 1, 1, 1, 0.6, 0.5, 0.2, 0.2, 0.19] },
  w4: { label: "Arma Nv 4", ore: { id: 984, name: "Oridecon" }, fee: 20000, rates: [1, 1, 1, 1, 0.6, 0.4, 0.4, 0.2, 0.2, 0.09] },
  armor: { label: "Armadura / equipamento", ore: { id: 985, name: "Elunium" }, fee: 2000, rates: [1, 1, 1, 1, 0.6, 0.4, 0.4, 0.2, 0.2, 0.09] },
};

/** Chance de um item que está em +from chegar em +to (quebra ao falhar). */
export function chanceOne(type: ItemType, from: number, to: number): number {
  let p = 1;
  for (let k = from; k < to; k++) p *= ITEM_TYPES[type].rates[k];
  return p;
}

/** Tentativas (= minérios) esperadas para um item de +from até sucesso em +to ou quebrar. */
export function attemptsOne(type: ItemType, from: number, to: number): number {
  let survive = 1, a = 0;
  for (let k = from; k < to; k++) { a += survive; survive *= ITEM_TYPES[type].rates[k]; }
  return a;
}

/** Itens refinados em sequência até o primeiro chegar no alvo. */
export function projectOdds(type: ItemType, levels: number[], to: number) {
  const sorted = [...levels].sort((a, b) => b - a); // começa pelos mais refinados
  let pAllFail = 1, ores = 0;
  for (const l of sorted) {
    if (l >= to) return { chance: 1, ores: 0, done: true };
    ores += pAllFail * attemptsOne(type, l, to);
    pAllFail *= 1 - chanceOne(type, l, to);
  }
  const each = chanceOne(type, 0, to);
  return { chance: 1 - pAllFail, ores, done: false, itemsFor50: each > 0 ? Math.ceil(Math.log(0.5) / Math.log(1 - each)) : Infinity, each };
}
