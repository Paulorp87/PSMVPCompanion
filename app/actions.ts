"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { q } from "@/lib/db";
import { STATUSES } from "@/lib/status";

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

export type HistItem = { item_id: number; item_name: string; qty: number };

export async function saveHistory(characterId: number, mvp: string, items: HistItem[], complete: boolean): Promise<{ ok: boolean; msg: string }> {
  const clean = items
    .map((i) => ({ item_id: Math.floor(Number(i.item_id)), item_name: String(i.item_name || `Item ${i.item_id}`).trim(), qty: Math.floor(Number(i.qty)) }))
    .filter((i) => i.item_id > 0 && Number.isFinite(i.qty) && i.qty >= 0);
  await q("DELETE FROM history WHERE character_id=$1 AND mvp=$2", [characterId, mvp]);
  for (const i of clean) {
    if (i.qty === 0) continue;
    await q("INSERT INTO history(character_id, mvp, item_id, item_name, qty) VALUES ($1,$2,$3,$4,$5)",
      [characterId, mvp, i.item_id, i.item_name, i.qty]);
  }
  await q(
    `INSERT INTO history_flag(character_id, mvp, complete, updated_at) VALUES ($1,$2,$3,now())
     ON CONFLICT (character_id, mvp) DO UPDATE SET complete=EXCLUDED.complete, updated_at=now()`,
    [characterId, mvp, complete]);
  revalidatePath("/", "layout");
  const n = clean.filter((i) => i.qty > 0).length;
  return { ok: true, msg: `Drops até hoje de ${mvp} salvos (${n} item(s))${complete ? ", marcado como histórico completo" : ""}.` };
}

export async function setMobIdAction(form: FormData) {
  const { setMobId } = await import("@/lib/ps");
  const name = String(form.get("name") ?? "");
  const id = Number(form.get("mob_id"));
  if (name && id > 0) { try { await setMobId(name, id); } catch {} }
  revalidatePath("/", "layout");
  redirect(`/mvp/${encodeURIComponent(name)}`);
}

export async function reloadMvp(form: FormData) {
  const { mvpInfo } = await import("@/lib/ps");
  const name = String(form.get("name") ?? "");
  try { await mvpInfo(name, true); } catch {}
  revalidatePath("/", "layout");
  redirect(`/mvp/${encodeURIComponent(name)}`);
}

// ---------- Destino dos drops ----------

/** Separa `n` unidades de um drop numa linha nova (ou devolve a mesma se for tudo). */
async function splitOff(id: number, n: number): Promise<number | null> {
  const r = await q<{ qty: number }>("SELECT qty FROM drops WHERE id=$1", [id]);
  if (!r[0]) return null;
  const qty = r[0].qty;
  n = Math.max(1, Math.min(Math.floor(n), qty));
  if (n === qty) return id;
  await q("UPDATE drops SET qty=qty-$2 WHERE id=$1", [id, n]);
  const ins = await q<{ id: number }>(
    `INSERT INTO drops(dropped_on, character_id, mvp, item_id, item_name, qty, status, project_id, refine, sold_price, split, source)
     SELECT dropped_on, character_id, mvp, item_id, item_name, $2, status, project_id, refine, sold_price, split, source FROM drops WHERE id=$1 RETURNING id`,
    [id, n]);
  return ins[0].id;
}

export async function updateDrop(id: number, f: { status?: string; qty?: number; sold_price?: number | null; split?: number; project_id?: number | null }) {
  if (f.status === "projeto" && f.project_id) {
    const cur = await q<{ qty: number }>("SELECT qty FROM drops WHERE id=$1", [id]);
    if (!cur[0]) return;
    if (f.split) await q("UPDATE drops SET split=$2 WHERE id=$1", [id, Math.max(1, Math.floor(f.split))]);
    return addToProject(f.project_id, id, f.qty ?? cur[0].qty);
  }
  // muda só `qty` unidades (separa a linha se for parte)
  const target = f.qty ? await splitOff(id, f.qty) : id;
  if (!target) return;
  const status = f.status && (STATUSES as readonly string[]).includes(f.status) ? f.status : undefined;
  await q(
    `UPDATE drops SET
       status = COALESCE($2, status),
       sold_price = CASE WHEN $3::boolean THEN $4::numeric ELSE sold_price END,
       split = COALESCE($5, split),
       project_id = CASE WHEN $6::boolean THEN $7::int ELSE project_id END
     WHERE id=$1`,
    [target, status ?? null, f.sold_price !== undefined, f.sold_price ?? null,
     f.split ? Math.max(1, Math.floor(f.split)) : null, f.project_id !== undefined, f.project_id ?? null]);
  if (status && status !== "projeto" && f.project_id === undefined) await q("UPDATE drops SET project_id=NULL WHERE id=$1 AND status<>'projeto'", [target]);
  revalidatePath("/", "layout");
}

/** Traz unidades dos "Drops até hoje" para o estoque com status (não conta de novo na rentabilidade). */
export async function importFromHistory(characterId: number, mvp: string, itemId: number, n: number, status: string, projectId: number | null) {
  const h = await q<{ item_name: string; qty: number }>(
    "SELECT item_name, qty FROM history WHERE character_id=$1 AND mvp=$2 AND item_id=$3", [characterId, mvp, itemId]);
  if (!h[0]) return { ok: false, msg: "Item não está no histórico." };
  const used = (await q<{ n: number }>(
    "SELECT COALESCE(SUM(qty),0)::int AS n FROM drops WHERE source='history' AND character_id=$1 AND mvp=$2 AND item_id=$3",
    [characterId, mvp, itemId]))[0].n;
  const free = h[0].qty - used;
  n = Math.floor(n);
  if (n < 1 || n > free) return { ok: false, msg: `Só dá para importar até ${free}.` };
  const st = (STATUSES as readonly string[]).includes(status) ? status : "guardando";
  const rows = st === "projeto" ? Array(n).fill(1) : [n];
  for (const qty of rows) {
    await q(
      `INSERT INTO drops(dropped_on, character_id, mvp, item_id, item_name, qty, status, project_id, source, project_at)
       VALUES (CURRENT_DATE,$1,$2,$3,$4,$5,$6,$7,'history', CASE WHEN $7::int IS NULL THEN NULL ELSE now() END)`,
      [characterId, mvp, itemId, h[0].item_name, qty, st, st === "projeto" ? projectId : null]);
  }
  revalidatePath("/", "layout");
  return { ok: true, msg: `${n} ${h[0].item_name} importado(s) do histórico.` };
}

// ---------- Projetos ----------
export async function createProject(form: FormData) {
  const itemId = Number(form.get("item_id"));
  const { STATIC_MVPS } = await import("@/lib/static-data");
  let known = "";
  for (const m of Object.values(STATIC_MVPS)) { const d = m.drops.find((x) => x.id === itemId); if (d) { known = d.name; break; } }
  const itemName = String(form.get("item_name") ?? "").trim() || known || `Item ${itemId}`;
  const target = Math.max(1, Math.min(10, Number(form.get("target_refine"))));
  const type = String(form.get("item_type") ?? "w4");
  const { chanceOne } = await import("@/lib/refine");
  const avg = Math.ceil(1 / chanceOne((["w1","w2","w3","w4","armor"].includes(type) ? type : "w4") as "w4", 0, target));
  const qty = Math.max(1, Number(form.get("target_qty")) || avg); // sem meta: usa a média do site
  const name = String(form.get("name") ?? "").trim() || `${itemName} +${target}`;
  if (!itemId) redirect("/projetos?e=1");
  const r = await q<{ id: number }>(
    "INSERT INTO projects(name, item_id, item_name, item_type, target_refine, target_qty) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
    [name, itemId, itemName, type, target, qty]);
  revalidatePath("/", "layout");
  redirect(`/projetos/${r[0].id}`);
}

/** Coloca `n` unidades de um drop do estoque no projeto, uma linha por unidade. */
export async function addToProject(projectId: number, dropId: number, n: number) {
  for (let i = 0; i < n; i++) {
    const id = await splitOff(dropId, 1);
    if (!id) break;
    await q("UPDATE drops SET status='projeto', project_id=$2, qty=1, project_at=COALESCE(project_at, now()) WHERE id=$1", [id, projectId]);
    if (id === dropId) break; // era a última unidade
  }
  revalidatePath("/", "layout");
}

export async function setRefine(dropId: number, level: number) {
  await q("UPDATE drops SET refine=$2 WHERE id=$1", [dropId, Math.max(0, Math.min(10, Math.floor(level)))]);
  revalidatePath("/", "layout");
}

export async function breakItem(dropId: number, broken: boolean) {
  await q("UPDATE drops SET status=$2 WHERE id=$1", [dropId, broken ? "quebrou" : "projeto"]);
  revalidatePath("/", "layout");
}

export async function setProjectStatus(form: FormData) {
  const id = Number(form.get("id"));
  const st = String(form.get("status"));
  if (st === "apagar") {
    await q("UPDATE drops SET status='guardando', project_id=NULL WHERE project_id=$1 AND status='projeto'", [id]);
    await q("DELETE FROM projects WHERE id=$1", [id]);
    revalidatePath("/", "layout");
    redirect("/projetos");
  }
  await q("UPDATE projects SET status=$2 WHERE id=$1", [id, st === "concluido" ? "concluido" : "juntando"]);
  revalidatePath("/", "layout");
  redirect(`/projetos/${id}`);
}

// ---------- Drop rápido ----------
export async function quickDrop(characterId: number | null, mvp: string, itemId: number, itemName: string, qty: number, split: number, status = "sem_status", soldPrice: number | null = null, support = false) {
  const st = (STATUSES as readonly string[]).includes(status) && status !== "projeto" ? status : "sem_status";
  const r = await q<{ id: number }>(
    `INSERT INTO drops(dropped_on, character_id, mvp, item_id, item_name, qty, split, status, sold_price, support)
     VALUES ((now() AT TIME ZONE 'America/Chicago')::date, $1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [characterId, mvp, itemId, itemName, Math.max(1, Math.floor(qty)), Math.max(1, Math.floor(split)), st,
     st === "vendido" && soldPrice ? soldPrice : null, support]);
  revalidatePath("/", "layout");
  return r[0].id;
}

export async function undoDrop(id: number) {
  await q("DELETE FROM drops WHERE id=$1", [id]);
  revalidatePath("/", "layout");
}

// ---------- Estoque semanal ----------
export async function saveStock(form: FormData) {
  const week = String(form.get("week") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) redirect("/estoque?e=1");
  const { STOCK_ITEMS } = await import("@/lib/stock");
  for (const it of STOCK_ITEMS) {
    const v = String(form.get(`q${it.id}`) ?? "").trim();
    if (v === "") continue;
    await q(`INSERT INTO stock(item_id, week, qty) VALUES ($1,$2,$3)
             ON CONFLICT (item_id, week) DO UPDATE SET qty=EXCLUDED.qty`, [it.id, week, Math.max(0, Math.floor(Number(v)))]);
  }
  revalidatePath("/", "layout");
  redirect("/estoque?ok=1");
}

// ---------- Usei / captura ----------
/** Marca `n` unidades como usadas. Itens de captura: `caught` delas viram ovo, o resto fica como falha. */
export async function useItem(dropId: number, n: number, caught: number) {
  const { TAMING } = await import("@/lib/taming");
  const cur = (await q<{ qty: number; item_id: number; character_id: number | null; mvp: string }>(
    "SELECT qty, item_id, character_id, mvp FROM drops WHERE id=$1", [dropId]))[0];
  if (!cur) return;
  n = Math.max(1, Math.min(Math.floor(n), cur.qty));
  const tame = TAMING[cur.item_id];
  if (!tame) {
    const id = await splitOff(dropId, n);
    if (id) await q("UPDATE drops SET status='usado', project_id=NULL WHERE id=$1", [id]);
  } else {
    caught = Math.max(0, Math.min(Math.floor(caught), n));
    if (caught > 0) {
      const id = await splitOff(dropId, caught);
      if (id) await q("UPDATE drops SET status='usado', capture='sucesso', project_id=NULL WHERE id=$1", [id]);
      await q(
        `INSERT INTO drops(dropped_on, character_id, mvp, item_id, item_name, qty, status, source)
         VALUES ((now() AT TIME ZONE 'America/Chicago')::date, $1, $2, $3, $4, $5, 'sem_status', 'captura')`,
        [cur.character_id, cur.mvp, tame.eggId, tame.eggName, caught]);
    }
    const fails = n - caught;
    if (fails > 0) {
      const left = (await q<{ qty: number }>("SELECT qty FROM drops WHERE id=$1", [dropId]))[0];
      // se a linha original foi toda para "sucesso", não sobra nada para falha
      if (left && !(caught > 0 && left.qty === caught && caught === cur.qty)) {
        const id = await splitOff(dropId, fails);
        if (id) await q("UPDATE drops SET status='usado', capture='falha', project_id=NULL WHERE id=$1", [id]);
      }
    }
  }
  revalidatePath("/", "layout");
}

// ---------- Suporte ----------
export async function addSupport(characterId: number | null, mvp: string) {
  const r = await q<{ id: number }>(
    "INSERT INTO support(character_id, mvp, day) VALUES ($1,$2,(now() AT TIME ZONE 'America/Chicago')::date) RETURNING id",
    [characterId, mvp.trim()]);
  revalidatePath("/", "layout");
  return r[0].id;
}

export async function undoSupport(id: number) {
  await q("DELETE FROM support WHERE id=$1", [id]);
  revalidatePath("/", "layout");
}

// ---------- Dei over ----------
/** Refina `n` unidades do drop até +level (mantém o destino atual). */
export async function setOver(dropId: number, n: number, level: number) {
  const id = await splitOff(dropId, n);
  if (!id) return;
  await q("UPDATE drops SET refine=$2 WHERE id=$1", [id, Math.max(0, Math.min(10, Math.floor(level)))]);
  revalidatePath("/", "layout");
}
