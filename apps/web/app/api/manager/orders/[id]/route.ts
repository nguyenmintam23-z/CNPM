import { NextRequest, NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };
const NO_CACHE = { "Cache-Control": "no-store" };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: NO_CACHE });
}

// Read-only. Phân quyền MANAGER do NestJS API thực thi.
export async function GET(request: NextRequest, context: Context) {
  const upstream = process.env.API_UPSTREAM_URL;
  if (!upstream) return errorResponse("Chưa cấu hình API Backend", 503);

  const { id } = await context.params;
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) {
    return errorResponse("ID đơn hàng không hợp lệ", 400);
  }

  try {
    const response = await fetch(
      `${upstream.replace(/\/+$/, "")}/manager/orders/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: { Cookie: request.headers.get("cookie") ?? "" },
        cache: "no-store",
      },
    );
    const payload: unknown = await response.json().catch(() => null);
    const result = NextResponse.json(payload, {
      status: response.status,
      headers: NO_CACHE,
    });
    for (const cookie of response.headers.getSetCookie()) {
      result.headers.append("Set-Cookie", cookie);
    }
    return result;
  } catch {
    return errorResponse("Không thể kết nối API Backend", 502);
  }
}
