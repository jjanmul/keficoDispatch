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
