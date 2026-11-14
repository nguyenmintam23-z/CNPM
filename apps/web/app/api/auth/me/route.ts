import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const upstream = process.env.API_UPSTREAM_URL;
  if (!upstream) {
    return NextResponse.json({ message: "Chưa cấu hình API Backend" }, { status: 503 });
  }

  try {
    const response = await fetch(`${upstream.replace(/\/$/, "")}/auth/me`, {
      method: "GET",
      headers: { Cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
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
