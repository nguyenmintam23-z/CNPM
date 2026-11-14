import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const apiUrl = process.env.API_UPSTREAM_URL;

  if (!apiUrl) {
    return NextResponse.json(
      { message: "Chưa cấu hình API Backend" },
      { status: 503 }
    );
  }

  try {
    const body: unknown = await request.json();

    const response = await fetch(
      `${apiUrl.replace(/\/$/, "")}/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") ?? "",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    const data: unknown = await response.json();
    const result = NextResponse.json(data, { status: response.status });

    // Preserve the session cookie set by the NestJS API.
    for (const cookie of response.headers.getSetCookie()) {
      result.headers.append("Set-Cookie", cookie);
    }

    return result;
  } catch {
    return NextResponse.json(
      { message: "Không thể xử lý yêu cầu đăng nhập" },
      { status: 502 }
    );
  }
}
