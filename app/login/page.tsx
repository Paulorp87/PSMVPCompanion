import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authToken } from "@/lib/auth";

async function login(form: FormData) {
  "use server";
  const pw = process.env.APP_PASSWORD;
  if (!pw || String(form.get("pw")) !== pw) redirect("/login?e=1");
  (await cookies()).set("kc_auth", await authToken(pw), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180,
  });
  redirect("/");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div style={{ maxWidth: 340, margin: "60px auto" }}>
      <h1>Entrar</h1>
      {e && <p className="flash err">Senha errada.</p>}
      <form action={login} className="panel" style={{ display: "grid", gap: 10 }}>
        <label className="f">Senha<input type="password" name="pw" autoFocus required /></label>
        <button className="btn">Entrar</button>
      </form>
    </div>
  );
}
