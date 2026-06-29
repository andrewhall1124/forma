import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const syncUrl = process.env.GARMIN_SYNC_URL;
  if (!syncUrl) {
    return Response.json({ error: "GARMIN_SYNC_URL not configured" }, { status: 503 });
  }

  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");

  const res = await fetch(`${syncUrl}/sync?days=${days}`, {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
  });

  const body = await res.json();
  return Response.json(body, { status: res.status });
}
