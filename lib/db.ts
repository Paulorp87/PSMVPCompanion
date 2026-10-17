import { Pool, PoolClient } from "pg";
import { SEED_CHARACTERS, SEED_WEEKS, ADJUST_CHARACTER, parseList, slug } from "./seed";

const g = globalThis as unknown as { _pool?: Pool; _ready?: Promise<void> };

function pool(): Pool {
  if (!g._pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada");
    const local = /localhost|127\.0\.0\.1|\/tmp|host=\//.test(url);
    g._pool = new Pool({
      connectionString: url,
      ssl: local ? undefined : { rejectUnauthorized: false },
      max: 3,
    });
  }
  return g._pool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS characters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort INT NOT NULL DEFAULT 0,
  sprite TEXT
);
CREATE TABLE IF NOT EXISTS kc (
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  mvp TEXT NOT NULL,
  week DATE NOT NULL,
  kills INT NOT NULL CHECK (kills >= 0),
  PRIMARY KEY (character_id, mvp, week)
);
CREATE TABLE IF NOT EXISTS drops (
  id SERIAL PRIMARY KEY,
  dropped_on DATE NOT NULL DEFAULT CURRENT_DATE,
  character_id INT REFERENCES characters(id) ON DELETE SET NULL,
  mvp TEXT NOT NULL,
  item_id INT NOT NULL,
  item_name TEXT NOT NULL,
  qty INT NOT NULL DEFAULT 1 CHECK (qty > 0)
);
CREATE TABLE IF NOT EXISTS mvps (
  name TEXT PRIMARY KEY,
  mob_id INT,
  drops JSONB,
  fetched_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS prices (
  item_id INT PRIMARY KEY,
  name TEXT,
  price NUMERIC,
  samples INT,
  source TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function init(): Promise<void> {
  const c = await pool().connect();
  try {
    await c.query("SELECT pg_advisory_lock(424242)");
    await c.query(SCHEMA);
    const { rows } = await c.query("SELECT count(*)::int AS n FROM characters");
    if (rows[0].n === 0) await seed(c);
    await c.query("SELECT pg_advisory_unlock(424242)");
  } finally {
    c.release();
  }
}

async function seed(c: PoolClient) {
  await c.query("BEGIN");
  const ids: Record<string, number> = {};
  const all = [...SEED_CHARACTERS, ADJUST_CHARACTER];
  for (let i = 0; i < all.length; i++) {
    const n = all[i];
    const sprite = n === ADJUST_CHARACTER ? null : `/sprites/${slug(n)}.png`;
    const r = await c.query(
      "INSERT INTO characters(name, sort, sprite) VALUES ($1,$2,$3) RETURNING id",
      [n, i, sprite]
    );
    ids[n] = r.rows[0].id;
  }
  for (const w of SEED_WEEKS) {
    for (const [ch, list] of Object.entries(w.data)) {
      for (const { mvp, kills } of parseList(list)) {
        await c.query(
          "INSERT INTO kc(character_id, mvp, week, kills) VALUES ($1,$2,$3,$4)",
          [ids[ch], mvp, w.week, kills]
        );
      }
    }
  }
  await c.query("COMMIT");
}

export async function db(): Promise<Pool> {
  if (!g._ready) g._ready = init().catch((e) => { g._ready = undefined; throw e; });
  await g._ready;
  return pool();
}

export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const p = await db();
  const r = await p.query(sql, params);
  return r.rows as T[];
}
