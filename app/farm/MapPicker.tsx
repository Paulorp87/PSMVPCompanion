"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MapInfo } from "@/lib/farm";

const norm = (t: string) => t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function MapPicker({ maps, builds, recent }: { maps: MapInfo[]; builds: string[]; recent: { map_id: string; map_name: string }[] }) {
  const router = useRouter();
  const [find, setFind] = useState("");
  const [map, setMap] = useState<{ id: string; name: string } | null>(null);
  const [build, setBuild] = useState("");
  const f = norm(find.trim());
  const hits = f.length >= 2
    ? maps.filter((m) => norm(m.map_name).includes(f) || norm(m.map_id).includes(f) || m.mobs.some((x) => norm(x).includes(f))).slice(0, 12)
    : [];

  return (
    <div className="panel">
      <label className="f">Mapa
        {map ? (
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <b>{map.name}</b> <span className="dim">{map.id}</span>
            <button type="button" className="btn small ghost" onClick={() => setMap(null)}>trocar</button>
          </div>
        ) : (
          <input placeholder="Busque pelo nome do mapa, código (ex: gef_dun01) ou monstro" value={find} onChange={(e) => setFind(e.target.value)} />
        )}
      </label>
      {!map && recent.length > 0 && f.length < 2 && (
        <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          <span className="dim" style={{ fontSize: 12 }}>Últimos:</span>
          {recent.map((r) => <button key={r.map_id} type="button" className="btn small ghost" onClick={() => setMap({ id: r.map_id, name: r.map_name })}>{r.map_name}</button>)}
        </div>
      )}
      {!map && hits.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
          {hits.map((m) => (
            <button key={m.map_id} type="button" className="btn small ghost" style={{ display: "block", textAlign: "left" }}
              onClick={() => { setMap({ id: m.map_id, name: m.map_name }); setFind(""); }}>
              <b>{m.map_name}</b> <span className="dim">{m.map_id}</span>
              <div className="dim" style={{ fontSize: 11 }}>{m.mobs.slice(0, 8).join(", ")}{m.mobs.length > 8 ? "…" : ""}</div>
            </button>
          ))}
        </div>
      )}
      {!map && f.length >= 2 && hits.length === 0 && <p className="note">Nenhum mapa com esse nome ou monstro.</p>}

      <label className="f" style={{ marginTop: 10 }}>Classe e build
        <input list="builds" placeholder="ex.: BS de meteoro, Kina de Jabber" value={build} onChange={(e) => setBuild(e.target.value)} />
        <datalist id="builds">{builds.map((b) => <option key={b} value={b} />)}</datalist>
      </label>
      <button className="btn" style={{ marginTop: 10 }} disabled={!map || !build.trim()}
        onClick={() => map && router.push(`/farm/nova?map=${encodeURIComponent(map.id)}&build=${encodeURIComponent(build.trim())}`)}>
        Carregar loots do mapa
      </button>
    </div>
  );
}
