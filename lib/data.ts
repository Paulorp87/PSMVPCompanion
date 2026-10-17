import { q } from "./db";

export type Character = { id: number; name: string; sort: number; sprite: string | null };

export function toISO(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function todayChicago(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
}

export async function getWeeks(): Promise<string[]> {
  const rows = await q<{ week: string }>("SELECT DISTINCT to_char(week,'YYYY-MM-DD') AS week FROM kc ORDER BY week DESC");
  return rows.map((r) => r.week);
}

// Valor vigente de cada (personagem, MVP) até a data: o último registro <= data.
const LATEST = `
  SELECT DISTINCT ON (character_id, mvp) character_id, mvp, kills, week
  FROM kc WHERE week <= $1::date
  ORDER BY character_id, mvp, week DESC`;

export async function totalsByMvp(week: string): Promise<Map<string, number>> {
  const rows = await q<{ mvp: string; total: number }>(
    `SELECT mvp, SUM(kills)::int AS total FROM (${LATEST}) t GROUP BY mvp`, [week]);
  return new Map(rows.map((r) => [r.mvp, r.total]));
}

export async function totalsByCharacter(week: string): Promise<Map<number, number>> {
  const rows = await q<{ character_id: number; total: number }>(
    `SELECT character_id, SUM(kills)::int AS total FROM (${LATEST}) t GROUP BY character_id`, [week]);
  return new Map(rows.map((r) => [r.character_id, r.total]));
}

export async function getCharacters(): Promise<Character[]> {
  return q<Character>("SELECT id, name, sort, sprite FROM characters ORDER BY sort, id");
}

export async function getCharacter(id: number): Promise<Character | null> {
  const r = await q<Character>("SELECT id, name, sort, sprite FROM characters WHERE id=$1", [id]);
  return r[0] ?? null;
}

export type CharMvp = { mvp: string; kills: number; week: string };

export async function characterMvps(id: number): Promise<CharMvp[]> {
  return q<CharMvp>(
    `SELECT mvp, kills, to_char(week,'YYYY-MM-DD') AS week FROM (
       SELECT DISTINCT ON (mvp) mvp, kills, week FROM kc WHERE character_id=$1
       ORDER BY mvp, week DESC) t
     ORDER BY kills DESC, mvp`, [id]);
}

export async function knownMvps(): Promise<string[]> {
  const rows = await q<{ mvp: string }>(
    "SELECT mvp FROM kc UNION SELECT mvp FROM drops UNION SELECT name FROM mvps ORDER BY 1");
  return rows.map((r) => r.mvp);
}
