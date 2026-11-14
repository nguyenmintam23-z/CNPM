import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const upstream = process.env.API_UPSTREAM_URL;
  if (!upstream) {
    return NextResponse.json(
      { message: "Chưa cấu hình API Backend" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { statusCode: 400, message: "Dữ liệu đăng ký không hợp lệ" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${upstream.replace(/\/$/, "")}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    // Keep NestJS success/error status and response payload intact.
    const payload: unknown = await response.json().catch(() => null);
    const result = NextResponse.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
    // Forward cookies according to the proxy contract, even though
    // successful registration does not create a login session.
    for (const cookie of response.headers.getSetCookie()) {
      result.headers.append("Set-Cookie", cookie);
    }
    return result;
  } catch {
    return NextResponse.json(
      { message: "Không thể kết nối API Backend" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
