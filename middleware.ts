import { NextRequest, NextResponse } from "next/server";
import { authToken } from "./lib/auth";

export async function middleware(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.next(); // sem senha configurada (uso local)
  if (req.cookies.get("kc_auth")?.value === (await authToken(pw))) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|_next|sprites|favicon.ico).*)"],
};
