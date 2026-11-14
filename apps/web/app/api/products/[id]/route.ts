import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const upstream = process.env.API_UPSTREAM_URL;
  if (!upstream) {
    return NextResponse.json({ message: "Chưa cấu hình API Backend" }, { status: 503 });
  }

  const { id } = await context.params;
  try {
    const response = await fetch(
      `${upstream.replace(/\/$/, "")}/products/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: { Cookie: request.headers.get("cookie") ?? "" },
        cache: "no-store",
      }
    );
    const payload: unknown = await response.json().catch(() => null);
    const result = NextResponse.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
    for (const cookie of response.headers.getSetCookie()) {
      result.headers.append("Set-Cookie", cookie);
    }
    return result;
  } catch {
    return NextResponse.json({ message: "Không thể kết nối API Backend" }, { status: 502 });
  }
}
