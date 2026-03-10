import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// 환경변수로 넣기(절대 코드에 하드코딩 금지)
const NCP_CLIENT_ID = process.env.NCP_CLIENT_ID;
const NCP_CLIENT_SECRET = process.env.NCP_CLIENT_SECRET;
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*"; // GitHub Pages 도메인으로 제한 권장

if (!NCP_CLIENT_ID || !NCP_CLIENT_SECRET) {
  console.error("Missing env: NCP_CLIENT_ID / NCP_CLIENT_SECRET");
  process.exit(1);
}

// CORS (프론트에서 호출 가능하게)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_, res) => res.json({ ok: true }));

// GET /api/geocode?query=...
app.get("/api/geocode", async (req, res) => {
  try {
    const query = (req.query.query || "").toString().trim();
    if (!query) return res.status(400).json({ error: "query is required" });

    const url = new URL("https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode");
    url.searchParams.set("query", query);

    const r = await fetch(url.toString(), {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": NCP_CLIENT_ID,
        "X-NCP-APIGW-API-KEY": NCP_CLIENT_SECRET,
        "Accept": "application/json",
      },
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: "naver geocode failed", detail: data });

    const first = data.addresses && data.addresses[0];
    if (!first) return res.json({ lat: null, lng: null });

    return res.json({ lat: Number(first.y), lng: Number(first.x) }); // y=lat, x=lng
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error", message: e.message });
  }
});

app.listen(PORT, () => console.log(`Proxy listening on http://localhost:${PORT}`));
