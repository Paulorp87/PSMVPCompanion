// Itens do Estoque (atualizados por você na página Estoque).
export const ORES = [
  { id: 985, name: "Elunium" },
  { id: 984, name: "Oridecon" },
];
export const POTIONS = [
  { id: 505, name: "Blue Potion" },
  { id: 504, name: "White Potion" },
  { id: 503, name: "Yellow Potion" },
];
export const HERBS = [
  { id: 510, name: "Blue Herb", potion: POTIONS[0] },
  { id: 509, name: "White Herb", potion: POTIONS[1] },
  { id: 508, name: "Yellow Herb", potion: POTIONS[2] },
];
export const STOCK_GROUPS = [
  { title: "Minérios", items: ORES },
  { title: "Ervas", items: HERBS.map(({ id, name }) => ({ id, name })) },
  { title: "Poções", items: POTIONS },
];
export const STOCK_ITEMS = STOCK_GROUPS.flatMap((g) => g.items);
// Elunium/Oridecon ficam fora da rentabilidade e do Drop rápido (controlados pelo Estoque).
export const STOCK_IDS: number[] = ORES.map((i) => i.id);
