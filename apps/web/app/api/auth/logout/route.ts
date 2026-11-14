import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const upstream = process.env.API_UPSTREAM_URL;
  if (!upstream) {
    return NextResponse.json({ message: "Chưa cấu hình API Backend" }, { status: 503 });
  }

  try {
    const response = await fetch(`${upstream.replace(/\/$/, "")}/auth/logout`, {
      method: "POST",
      headers: { Cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });

    // NestJS returns 204 without body; never parse JSON on a 204 response.
    const payload: unknown = response.status === 204
      ? null
      : await response.json().catch(() => null);
    const result = response.status === 204
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json(payload, { status: response.status });
    result.headers.set("Cache-Control", "no-store");

    // Preserve the Set-Cookie that expires the HttpOnly session cookie.
    for (const cookie of response.headers.getSetCookie()) {
      result.headers.append("Set-Cookie", cookie);
    }
    return result;
  } catch {
    return NextResponse.json({ message: "Không thể kết nối API Backend" }, { status: 502 });
  }
}
