// Recebe os dados que o Claude puxa do tools.payonstories.com pelo navegador do Paulo
// (a Cloudflare do PS bloqueia a Vercel). Protegido por token.
import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";

const TOKEN_SHA = "8efbef8efa7e7bb306aa6c4ea41fa8eac992c6ef5b8a96f69c2b34831847d1f7";

async function sha(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

const cors = { "Access-Control-Allow-Origin": "https://tools.payonstories.com", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: cors }); }

type Mob = { id: number; name: string; lv: number; hp: number; be: number; je: number; mvp: boolean; z: number | null; sp: [string, string, number][]; d: [number, string, number][] };
type Price = { id: number; name: string; p: number | null; s: number; last: string | null; npc?: number | null };

export async function POST(req: NextRequest) {
  const body = JSON.parse(await req.text());
  if (!body?.token || (await sha(body.token)) !== TOKEN_SHA) return NextResponse.json({ error: "token" }, { status: 401, headers: cors });
  let n = 0;
  if (body.kind === "mobs") {
    const mobs = body.data as Mob[];
    await q(
      `INSERT INTO ps_mobs(id, name, level, hp, base_exp, job_exp, is_mvp, zeny_kill, spawns, drops, updated_at)
       SELECT id, name, lv, hp, be, je, mvp, z, sp, d, now() FROM jsonb_to_recordset($1::jsonb)
         AS x(id int, name text, lv int, hp bigint, be bigint, je bigint, mvp boolean, z numeric, sp jsonb, d jsonb)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, level=EXCLUDED.level, hp=EXCLUDED.hp, base_exp=EXCLUDED.base_exp,
         job_exp=EXCLUDED.job_exp, is_mvp=EXCLUDED.is_mvp, zeny_kill=EXCLUDED.zeny_kill, spawns=EXCLUDED.spawns, drops=EXCLUDED.drops, updated_at=now()`,
      [JSON.stringify(mobs)]);
    n = mobs.length;
  } else if (body.kind === "prices") {
    const rows = (body.data as Price[]).map((p) => {
      if (p.p != null) {
        const last = p.last ? ` (última venda ${p.last.slice(8, 10)}/${p.last.slice(5, 7)}/${p.last.slice(0, 4)})` : "";
        return { item_id: p.id, name: p.name, price: p.p, samples: p.s, source: `mediana de ${p.s} dia(s) com venda${last}` };
      }
      if (p.npc != null) return { item_id: p.id, name: p.name, price: p.npc, samples: 0, source: "NPC (sem venda registrada na Price Check)" };
      return null;
    }).filter(Boolean);
    await q(
      `INSERT INTO prices(item_id, name, price, samples, source, fetched_at)
       SELECT item_id, name, price, samples, source, now() FROM jsonb_to_recordset($1::jsonb)
         AS x(item_id int, name text, price numeric, samples int, source text)
       ON CONFLICT (item_id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price, samples=EXCLUDED.samples, source=EXCLUDED.source, fetched_at=now()`,
      [JSON.stringify(rows)]);
    n = rows.length;
  } else return NextResponse.json({ error: "kind" }, { status: 400, headers: cors });
  return NextResponse.json({ ok: true, n }, { headers: cors });
}
