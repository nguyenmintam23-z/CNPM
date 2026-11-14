import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const apiUrl = process.env.API_UPSTREAM_URL;
  if (!apiUrl) {
    return NextResponse.json({ message: "Chưa cấu hình API Backend" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Dữ liệu đăng nhập không hợp lệ" }, { status: 400 });
  }

  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data: unknown = await response.json().catch(() => null);
    const result = NextResponse.json(data, { status: response.status, headers: { "Cache-Control": "no-store" } });
    for (const cookie of response.headers.getSetCookie()) {
      result.headers.append("Set-Cookie", cookie);
    }
    return result;
  } catch {
    return NextResponse.json({ message: "Không thể kết nối API Backend" }, { status: 502 });
  }
}
