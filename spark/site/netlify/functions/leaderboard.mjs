import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Content-Type": "application/json" };
const J = (o, s = 200, x = {}) => new Response(JSON.stringify(o), { status: s, headers: { ...H, ...x } });
const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
const DATE = /^\d{4}-\d\d-\d\d$/;

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  const st = getStore("spark-leaderboard");
  const url = new URL(req.url);

  if (req.method === "GET") {
    const from = url.searchParams.get("from"), to = url.searchParams.get("to");
    const cat = url.searchParams.get("cat") === "water" ? 1 : 0, me = url.searchParams.get("id") || "";
    if (!DATE.test(from) || !DATE.test(to)) return J({ error: "bad range" }, 400);
    const { blobs } = await st.list({ prefix: "u/" });
    const rows = [];
    for (let i = 0; i < blobs.length; i += 25) {
      const recs = await Promise.all(blobs.slice(i, i + 25).map((b) => st.get(b.key, { type: "json" }).catch(() => null)));
      recs.forEach((r, j) => {
        if (!r) return;
        let v = 0;
        for (const [d, a] of Object.entries(r.days)) if (d >= from && d <= to) v += a[cat];
        if (v > 0) rows.push({ n: r.n, c: r.c, v, me: blobs[i + j].key === "u/" + me });
      });
    }
    rows.sort((a, b) => b.v - a.v);
    rows.forEach((r, i) => (r.rank = i + 1));
    const mine = rows.find((r) => r.me) || null;
    return J({ top: rows.slice(0, 50), me: mine, total: rows.length }, 200, { "Cache-Control": "no-store" });
  }

  let b;
  try { b = await req.json(); } catch { return J({ error: "bad json" }, 400); }
  if (!/^[a-f0-9]{32}$/.test(b.id || "") || !/^[a-f0-9]{48}$/.test(b.sec || "")) return J({ error: "bad id" }, 400);
  const key = "u/" + b.id, old = await st.get(key, { type: "json" }).catch(() => null);
  if (old && old.h !== sha(b.sec)) return J({ error: "forbidden" }, 403);

  if (req.method === "DELETE") { await st.delete(key); return J({ ok: true }); }
  if (req.method !== "POST") return J({ error: "method" }, 405);

  const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
  const n = clean(b.nick, 20);
  if (n.length < 2) return J({ error: "nickname" }, 400);
  const days = { ...(old ? old.days : {}) };
  const ent = Object.entries(b.days || {}).slice(0, 40);
  for (const [d, a] of ent) {
    if (!DATE.test(d) || !Array.isArray(a)) continue;
    days[d] = [Math.max(0, Math.min(100000, Math.round(+a[0]) || 0)), Math.max(0, Math.min(10000, Math.round(+a[1]) || 0))];
  }
  const keep = Object.keys(days).sort().slice(-62);
  const out = {}; keep.forEach((d) => (out[d] = days[d]));
  await st.setJSON(key, { n, c: clean(b.city, 40), h: sha(b.sec), days: out, t: Date.now() });
  return J({ ok: true });
};
export const config = { path: "/api/leaderboard" };
