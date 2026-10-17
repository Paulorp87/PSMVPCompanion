import { NextRequest, NextResponse } from "next/server";
import { mvpInfo } from "@/lib/ps";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ error: "name" }, { status: 400 });
  try {
    return NextResponse.json(await mvpInfo(name));
  } catch (e) {
    return NextResponse.json({ name, mob_id: null, drops: [], error: String(e) }, { status: 200 });
  }
}
