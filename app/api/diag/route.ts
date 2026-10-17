import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE = "https://tools.payonstories.com";
const PATHS = ["/api/db/search?mode=mobs_filter&q=orc%20hero", "/api/db/entity?type=mob&id=1087", "/api/pc/history?id=985"];
const UAS: Record<string, string> = {
  app: "mvp-kc-tracker (uso pessoal, 1x/semana)",
  navegador: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
};

export async function GET() {
  const out: any[] = [];
  for (const [uaName, ua] of Object.entries(UAS)) {
    for (const p of PATHS) {
      const t = Date.now();
      try {
        const r = await fetch(BASE + p, {
          headers: { Accept: "application/json", "User-Agent": ua, Referer: BASE + "/pc" },
          signal: AbortSignal.timeout(15000), cache: "no-store",
        });
        const body = await r.text();
        out.push({ ua: uaName, path: p, status: r.status, ms: Date.now() - t, server: r.headers.get("server"),
          cfMitigated: r.headers.get("cf-mitigated"), contentType: r.headers.get("content-type"), body: body.slice(0, 200) });
      } catch (e) {
        out.push({ ua: uaName, path: p, error: String(e), ms: Date.now() - t });
      }
    }
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
