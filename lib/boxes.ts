// Caixas que dá pra abrir. Conteúdo puxado da Item Chance do Payon Stories (30/10/2026).
import oca from "@/data/oca-cards.json";

export type BoxItem = { id: number; name: string; price: number | null };
export const BOXES: Record<number, { name: string; chance: number; items: BoxItem[] }> = {
  616: { name: "Old Card Album", chance: 0.29, items: oca as BoxItem[] },
};
