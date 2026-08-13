import type { VercelRequest, VercelResponse } from "@vercel/node";

// Vercel serverless proxy for NSE's public archives (e.g. the EQUITY_L.csv
// symbol list). Same CORS situation as api/yahoo — archives.nseindia.com
// sends no Access-Control-Allow-Origin header. In local dev this same path
// is handled by Vite's dev-server proxy (vite.config.ts) instead.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { path, ...rest } = req.query;
  const upstreamPath = Array.isArray(path) ? path.join("/") : path ?? "";
  const qs = new URLSearchParams(rest as Record<string, string>).toString();
  const upstreamUrl = `https://archives.nseindia.com/${upstreamPath}${qs ? `?${qs}` : ""}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { "User-Agent": BROWSER_USER_AGENT },
    });
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "text/csv");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.send(body);
  } catch (err) {
    res.status(502).json({ error: "Upstream fetch failed", message: (err as Error).message });
  }
}
