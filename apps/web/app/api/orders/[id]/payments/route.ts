import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

// Proxy cùng origin: giữ cookie HttpOnly và để Backend kiểm tra chủ đơn.
export async function POST(request: NextRequest, context: RouteContext) {
  const upstream = process.env.API_UPSTREAM_URL;
  if (!upstream) {
    return NextResponse.json({ message: "Chưa cấu hình API Backend" }, { status: 503 });
  }

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ message: "Mã đơn không hợp lệ" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ message: "Thông tin thanh toán không hợp lệ" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (Object.keys(input).sort().join(",") !== "idempotencyKey,method" ||
      (input.method !== "WALLET" && input.method !== "CARD") ||
      typeof input.idempotencyKey !== "string" ||
      !/^[A-Za-z0-9_-]{8,64}$/.test(input.idempotencyKey)) {
    return NextResponse.json({ message: "Phương thức hoặc mã giao dịch không hợp lệ" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${upstream.replace(/\/$/, "")}/orders/${encodeURIComponent(id)}/payments`,
      {
        method: "POST",
        headers: {
          Cookie: request.headers.get("cookie") ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
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
