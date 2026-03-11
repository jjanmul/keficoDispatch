import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY;
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";

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

async function kakaoJson(url) {
  const r = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
  });
  const data = await r.json();
  return { ok: r.ok, status: r.status, data };
}

// GET /api/search?query=...&size=10
// - 키워드 검색(장소명 검색) 결과를 여러 건 반환
// - 응답: { items: [{ name, address, lat, lng, source }] }
app.get("/api/search", async (req, res) => {
  try {
    const query = (req.query.query || "").toString().trim();
    const sizeRaw = (req.query.size || "10").toString();
    const size = Math.max(1, Math.min(15, parseInt(sizeRaw, 10) || 10)); // 카카오는 보통 최대 15

    if (!query) return res.status(400).json({ error: "query is required" });

    const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
    url.searchParams.set("query", query);
    url.searchParams.set("size", String(size));

    const r = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: "kakao keyword search failed", detail: data });
    }

    const items = (data.documents || []).map((d) => ({
      name: d.place_name || "",
      address: d.road_address_name || d.address_name || "",
      lat: Number(d.y),
      lng: Number(d.x),
      source: "keyword",
      // 필요하면 아래도 추가 가능:
      // phone: d.phone,
      // placeUrl: d.place_url,
      // category: d.category_name,
    })).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng));

    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error", message: e.message });
  }
});


/**
 * GET /api/geocode?query=...
 * 1) 주소검색(address.json)
 * 2) 실패 시 키워드검색(keyword.json) fallback
 */
app.get("/api/geocode", async (req, res) => {
  try {
    const query = (req.query.query || "").toString().trim();
    if (!query) return res.status(400).json({ error: "query is required" });

    const addressUrl = new URL("https://dapi.kakao.com/v2/local/search/address.json");
    addressUrl.searchParams.set("query", query);

    const a = await kakaoJson(addressUrl);
    if (!a.ok) return res.status(a.status).json({ error: "kakao address search failed", detail: a.data });

    const addrFirst = a.data.documents?.[0];
    if (addrFirst) {
      return res.json({
        lat: Number(addrFirst.y),
        lng: Number(addrFirst.x),
        name:
          (addrFirst.road_address && addrFirst.road_address.address_name) ||
          (addrFirst.address && addrFirst.address.address_name) ||
          query,
        source: "address",
      });
    }

    const keywordUrl = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
    keywordUrl.searchParams.set("query", query);
    keywordUrl.searchParams.set("size", "1");

    const k = await kakaoJson(keywordUrl);
    if (!k.ok) return res.status(k.status).json({ error: "kakao keyword search failed", detail: k.data });

    const keyFirst = k.data.documents?.[0];
    if (!keyFirst) return res.json({ lat: null, lng: null, name: null, source: "none" });

    return res.json({
      lat: Number(keyFirst.y),
      lng: Number(keyFirst.x),
      name: keyFirst.place_name || query,
      source: "keyword",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error", message: e.message });
  }
});


app.listen(PORT, () => console.log(`Kakao proxy listening on :${PORT}`));
