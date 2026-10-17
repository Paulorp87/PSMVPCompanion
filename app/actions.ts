"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { q } from "@/lib/db";

export type KcEntry = { mvp: string; kills: number };

export async function saveKC(characterId: number, week: string, entries: KcEntry[]): Promise<{ ok: boolean; msg: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return { ok: false, msg: "Data inválida." };
  const clean = entries
    .map((e) => ({ mvp: e.mvp.trim().replace(/\s+/g, " "), kills: Math.floor(Number(e.kills)) }))
    .filter((e) => e.mvp && Number.isFinite(e.kills) && e.kills >= 0);
  if (!clean.length) return { ok: false, msg: "Nada para salvar." };
  for (const e of clean) {
    await q(
      `INSERT INTO kc(character_id, mvp, week, kills) VALUES ($1,$2,$3,$4)
       ON CONFLICT (character_id, mvp, week) DO UPDATE SET kills=EXCLUDED.kills`,
      [characterId, e.mvp, week, e.kills]);
  }
  revalidatePath("/", "layout");
  return { ok: true, msg: `${clean.length} MVP(s) salvos.` };
}

export async function createCharacter(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return;
  const r = await q<{ id: number }>(
    `INSERT INTO characters(name, sort) VALUES ($1, (SELECT COALESCE(MAX(sort),0)+1 FROM characters))
     ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [name]);
  revalidatePath("/");
  redirect(`/personagem/${r[0].id}`);
}

export async function deleteCharacter(form: FormData) {
  await q("DELETE FROM characters WHERE id=$1", [Number(form.get("id"))]);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function addDrop(form: FormData) {
  const mvp = String(form.get("mvp") ?? "").trim();
  const itemId = Number(form.get("item_id"));
  const itemName = String(form.get("item_name") ?? "").trim() || `Item ${itemId}`;
  const qty = Math.max(1, Math.floor(Number(form.get("qty") ?? 1)));
  const ch = Number(form.get("character_id")) || null;
  const day = String(form.get("dropped_on") ?? "");
  if (!mvp || !itemId) redirect("/drops?e=1");
  await q(
    "INSERT INTO drops(dropped_on, character_id, mvp, item_id, item_name, qty) VALUES (COALESCE(NULLIF($1,'')::date, CURRENT_DATE),$2,$3,$4,$5,$6)",
    [day, ch, mvp, itemId, itemName, qty]);
  revalidatePath("/", "layout");
  redirect(`/drops?ok=1&mvp=${encodeURIComponent(mvp)}`);
}

export async function deleteDrop(form: FormData) {
  await q("DELETE FROM drops WHERE id=$1", [Number(form.get("id"))]);
  revalidatePath("/", "layout");
  redirect("/drops");
}
