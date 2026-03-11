import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY;        // Kakao REST API Key
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";     // https://jjanmul.github.io 권장

if (!KAKAO_REST_KEY) {
  console.error("Missing env: KAKAO_REST_KEY");
  process.exit(1);
}

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_, res) => res.json({ ok: true }));

// GET /api/geocode?query=...
// - address 우선, 실패하면 keyword(place) 검색도 가능하게 확장 가능
app.get("/api/geocode", async (req, res) => {
  try {
    const query = (req.query.query || "").toString().trim();
    if (!query) return res.status(400).json({ error: "query is required" });

    const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
    url.searchParams.set("query", query);

    const r = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` }
    });
    const data = await r.json();

    if (!r.ok) return res.status(r.status).json({ error: "kakao geocode failed", detail: data });

    const first = data.documents && data.documents[0];
    if (!first) return res.json({ lat: null, lng: null });

    // Kakao: x=lng, y=lat (문자열로 옴)
    return res.json({ lat: Number(first.y), lng: Number(first.x) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error", message: e.message });
  }
});

app.listen(PORT, () => console.log(`Kakao proxy listening on :${PORT}`));
