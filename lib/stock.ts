// Itens controlados pelo estoque semanal (não entram na rentabilidade nem no Drop rápido).
export const STOCK_ITEMS = [
  { id: 985, name: "Elunium" },
  { id: 984, name: "Oridecon" },
] as const;
export const STOCK_IDS: number[] = STOCK_ITEMS.map((i) => i.id);
