import { herbInfo, HERB } from "@/lib/herb";
import { todayChicago, fmtDate } from "@/lib/data";
import { saveHerbGoal, saveHerbDay, saveHerbStock, deleteHerbDay, addHerbBuy, addHerbBrew, deleteHerbRow } from "@/app/actions";
import BarChart, { type Bar } from "@/app/estatisticas/BarChart";

export const dynamic = "force-dynamic";
const n = (x: number) => Math.round(x).toLocaleString("pt-BR");
const dm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const MSG: Record<string, string> = { meta: "Meta salva.", dia: "Dia registrado.", estoque: "Estoque salvo.", compra: "Compra registrada.", pocao: "Poções registradas." };
const pct = (x: number) => (x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";

export default async function Erva({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const sp = await searchParams;
  const h = await herbInfo();
  const today = todayChicago();
  const hoje = h.days.find((d) => d.day === today);
  const last = h.days.slice(-30);
  const bars: Bar[] = last.map((d) => ({
    label: dm(d.day), sub: d.goal > 0 ? (d.qty >= d.goal ? "✓" : "") : "", value: d.qty,
    tip: `${fmtDate(d.day)}: ${n(d.qty)} ervas · ${n(d.qty * h.price)} z${d.goal ? ` · meta ${n(d.goal)}` : ""}`,
  }));
  const avg = h.days.length ? h.total / h.days.length : null;
  const withGoal = h.days.filter((d) => d.goal > 0).length;

  return (
    <>
      <h1>Farm de Erva</h1>
      <p className="sub">{HERB.name}. Lance o estoque inicial, defina a meta diária e registre no fim do dia quantas farmou. Compras somam no estoque, e as que viram Blue Potion saem dele. Valor da erva farmada: {n(h.price)} z cada.</p>
      {sp.ok && <p className="flash">{MSG[sp.ok] ?? "Salvo."}</p>}
      {sp.e && <p className="flash err">{sp.e === "2" ? "Confira: as poções não podem ser mais que as ervas usadas." : "Preencha a data e a quantidade."}</p>}
      {!h.stockBase && <p className="flash">Comece lançando seu estoque inicial de Blue Herb em "Estoque inicial / contagem", lá embaixo.</p>}

      <div className="stats">
        <div className="stat"><div className="k">Hoje</div>
          <div className={`v num ${hoje && h.goal && hoje.qty >= h.goal ? "up" : ""}`}>{hoje ? n(hoje.qty) : "—"}{h.goal ? <span className="dim" style={{ fontSize: 16 }}> / {n(h.goal)}</span> : null}</div>
          <div className="note">{hoje ? `${n(hoje.qty * h.price)} z` : "ainda não registrou"}{h.goal && hoje ? (hoje.qty >= h.goal ? " · bateu a meta ✓" : ` · faltaram ${n(h.goal - hoje.qty)}`) : ""}</div></div>
        <div className="stat"><div className="k">Estoque</div><div className="v num accent">{n(h.stock)}</div>
          <div className="note">≈ {n(h.stock * h.price)} z{h.stockBase ? ` · contado em ${fmtDate(h.stockBase.day)}` : ""}</div></div>
        <div className="stat"><div className="k">Total farmado</div><div className="v num">{n(h.total)}</div>
          <div className="note">{n(h.total * h.price)} z em {h.days.length} dia(s)</div></div>
        <div className="stat"><div className="k">Média por dia</div><div className="v num">{avg != null ? n(avg) : "—"}</div>
          <div className="note">{withGoal ? `bateu a meta em ${h.hit} de ${withGoal} dia(s)` : "sem meta registrada ainda"}</div></div>
        <div className="stat"><div className="k">Compradas</div><div className="v num">{n(h.bought)}</div>
          <div className="note">{h.bought ? `${n(h.spent)} z · média ${n(h.spent / h.bought)} z cada` : "nenhuma compra"}</div></div>
        <div className="stat"><div className="k">Viraram Blue Potion</div><div className="v num up">{h.rate != null ? pct(h.rate) : "—"}</div>
          <div className="note">{h.used ? `${n(h.potions)} poções de ${n(h.used)} ervas usadas` : "nenhuma poção registrada"}</div></div>
      </div>

      <h2>Registrar o dia</h2>
      <form action={saveHerbDay} className="panel row">
        <label className="f">Data<input type="date" name="day" defaultValue={today} /></label>
        <label className="f">Ervas farmadas<input name="qty" className="kc-in num" inputMode="numeric" placeholder={hoje ? String(hoje.qty) : "0"} style={{ width: 130 }} /></label>
        <button className="btn">Salvar</button>
      </form>
      <p className="note">Coloque quantas farmou no dia (não o total do inventário). Salvar de novo na mesma data corrige.</p>

      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 280px" }}>
          <h2>Meta diária</h2>
          <form action={saveHerbGoal} className="panel row">
            <label className="f">Meta (ervas/dia)<input name="goal" className="kc-in num" inputMode="numeric" defaultValue={h.goal || ""} style={{ width: 110 }} /></label>
            <label className="f">Valor de cada (z)<input name="price" className="kc-in num" inputMode="numeric" defaultValue={h.price} style={{ width: 110 }} /></label>
            <button className="btn">Salvar meta</button>
          </form>
          {h.goal > 0 && <p className="note">Meta de {n(h.goal)}/dia = {n(h.goal * h.price)} z por dia.</p>}
        </div>
        <div style={{ flex: "1 1 280px" }}>
          <h2>Estoque inicial / contagem</h2>
          <form action={saveHerbStock} className="panel row">
            <label className="f">Data<input type="date" name="day" defaultValue={today} /></label>
            <label className="f">Quantas tem agora<input name="qty" className="kc-in num" inputMode="numeric" placeholder={String(h.stock)} style={{ width: 120 }} /></label>
            <button className="btn">Ajustar</button>
          </form>
          <p className="note">Lance aqui as ervas que você já tem. Use de novo sempre que contar o estoque de verdade: daí pra frente soma o que farmar e comprar e desconta o que virar poção.</p>
        </div>
      </div>

      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 280px" }}>
          <h2>Comprei erva</h2>
          <form action={addHerbBuy} className="panel row">
            <label className="f">Data<input type="date" name="day" defaultValue={today} /></label>
            <label className="f">Quantidade<input name="qty" className="kc-in num" inputMode="numeric" style={{ width: 100 }} /></label>
            <label className="f">Preço de cada (z)<input name="price" className="kc-in num" inputMode="numeric" style={{ width: 110 }} /></label>
            <button className="btn">Registrar</button>
          </form>
        </div>
        <div style={{ flex: "1 1 280px" }}>
          <h2>Fiz Blue Potion</h2>
          <form action={addHerbBrew} className="panel row">
            <label className="f">Data<input type="date" name="day" defaultValue={today} /></label>
            <label className="f">Ervas usadas<input name="used" className="kc-in num" inputMode="numeric" style={{ width: 100 }} /></label>
            <label className="f">Poções que saíram<input name="potions" className="kc-in num" inputMode="numeric" style={{ width: 110 }} /></label>
            <button className="btn">Registrar</button>
          </form>
          <p className="note">As ervas usadas saem do estoque; a % é poções ÷ ervas usadas.</p>
        </div>
      </div>

      <h2>Ervas por dia{h.days.length > 30 ? " (últimos 30)" : ""}</h2>
      <div className="panel"><BarChart bars={bars} avg={avg} goal={h.goal || null} unit="ervas" empty="Nenhum dia registrado ainda." /></div>

      {(h.buys.length > 0 || h.brews.length > 0) && (
        <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          {h.buys.length > 0 && <div style={{ flex: "1 1 280px" }}>
            <h2>Compras</h2>
            <div className="tbl"><table>
              <thead><tr><th>Data</th><th className="r">Qtd</th><th className="r">Preço</th><th className="r">Total</th><th></th></tr></thead>
              <tbody>{[...h.buys].reverse().map((b) => (
                <tr key={b.id}><td className="num">{fmtDate(b.day)}</td><td className="r num">{n(b.qty)}</td><td className="r num">{n(b.price)}</td><td className="r num">{n(b.qty * b.price)}</td>
                  <td className="r"><form action={deleteHerbRow}><input type="hidden" name="kind" value="buy" /><input type="hidden" name="id" value={b.id} /><button className="btn small ghost">apagar</button></form></td></tr>
              ))}</tbody>
            </table></div>
          </div>}
          {h.brews.length > 0 && <div style={{ flex: "1 1 280px" }}>
            <h2>Blue Potions</h2>
            <div className="tbl"><table>
              <thead><tr><th>Data</th><th className="r">Ervas</th><th className="r">Poções</th><th className="r">%</th><th></th></tr></thead>
              <tbody>{[...h.brews].reverse().map((b) => (
                <tr key={b.id}><td className="num">{fmtDate(b.day)}</td><td className="r num">{n(b.used)}</td><td className="r num">{n(b.potions)}</td><td className="r num">{pct(b.potions / b.used)}</td>
                  <td className="r"><form action={deleteHerbRow}><input type="hidden" name="kind" value="brew" /><input type="hidden" name="id" value={b.id} /><button className="btn small ghost">apagar</button></form></td></tr>
              ))}</tbody>
            </table></div>
          </div>}
        </div>
      )}

      {h.days.length > 0 && (
        <>
          <h2>Farm por dia</h2>
          <div className="tbl"><table>
            <thead><tr><th>Data</th><th className="r">Ervas</th><th className="r">Meta</th><th className="r">Zeny</th><th></th></tr></thead>
            <tbody>{[...h.days].reverse().map((d) => (
              <tr key={d.day}>
                <td className="num">{fmtDate(d.day)}</td>
                <td className={`r num ${d.goal && d.qty >= d.goal ? "up" : ""}`}>{n(d.qty)}{d.goal && d.qty >= d.goal ? " ✓" : ""}</td>
                <td className="r num dim">{d.goal ? n(d.goal) : "—"}</td>
                <td className="r num">{n(d.qty * h.price)}</td>
                <td className="r"><form action={deleteHerbDay}><input type="hidden" name="day" value={d.day} /><button className="btn small ghost">apagar</button></form></td>
              </tr>
            ))}</tbody>
          </table></div>
        </>
      )}
    </>
  );
}
