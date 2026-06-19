/**
 * 2026 World Cup Score Proxy - Cloudflare Worker
 *
 * 部署后，把 index.html 里的 SCORE_PROXY_BASE 改成你的 Worker 地址：
 * const SCORE_PROXY_BASE = "https://你的worker.workers.dev";
 *
 * 支持接口：
 * /score/header
 * /score/scoreboard?dates=20260614&limit=100
 * /score/summary?event=760421
 */

const ESPN_ENDPOINTS = {
  header: "https://site.api.espn.com/apis/v2/scoreboard/header",
  scoreboard: "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard",
  summary: "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export default {
  async fetch(request) {
    const reqUrl = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    let targetBase = "";
    if (reqUrl.pathname === "/score/header") {
      targetBase = ESPN_ENDPOINTS.header;
    } else if (reqUrl.pathname === "/score/scoreboard") {
      targetBase = ESPN_ENDPOINTS.scoreboard;
    } else if (reqUrl.pathname === "/score/summary") {
      targetBase = ESPN_ENDPOINTS.summary;
    } else if (reqUrl.pathname === "/" || reqUrl.pathname === "/health") {
      return jsonResponse({ ok: true, service: "world-cup-score-proxy" });
    } else {
      return jsonResponse({ error: "Not found" }, 404);
    }

    const target = new URL(targetBase);

    // 默认参数
    if (reqUrl.pathname === "/score/header") {
      target.searchParams.set("sport", reqUrl.searchParams.get("sport") || "soccer");
      target.searchParams.set("league", reqUrl.searchParams.get("league") || "fifa.world");
    }

    // 透传参数
    for (const [key, value] of reqUrl.searchParams.entries()) {
      if (key === "_") continue;
      target.searchParams.set(key, value);
    }

    try {
      const upstream = await fetch(target.toString(), {
        headers: {
          "Accept": "application/json,text/plain,*/*",
          "User-Agent": "Mozilla/5.0 WorldCupScoreProxy/1.0",
        },
        cf: {
          cacheTtl: 0,
          cacheEverything: false,
        },
      });

      const text = await upstream.text();

      return new Response(text, {
        status: upstream.status,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    } catch (err) {
      return jsonResponse({
        error: "Upstream request failed",
        message: String(err && err.message || err),
        target: target.toString(),
      }, 502);
    }
  },
};
