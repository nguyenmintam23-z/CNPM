import { NextRequest, NextResponse } from "next/server";
import { isManagerStatus } from "../../../../lib/manager-orders";

const NO_CACHE = { "Cache-Control": "no-store" };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: NO_CACHE });
}

function validPositiveInteger(value: string | null, max: number): boolean {
  return value === null || (
    /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value)) && Number(value) <= max
  );
}

// Read-only. Phân quyền bắt buộc do NestJS API thực thi (401/403).
export async function GET(request: NextRequest) {
  const upstream = process.env.API_UPSTREAM_URL;
  if (!upstream) return errorResponse("Chưa cấu hình API Backend", 503);

  const incoming = request.nextUrl.searchParams;
  const status = incoming.get("status");
  const page = incoming.get("page");
  const pageSize = incoming.get("pageSize");

  if (status !== null && !isManagerStatus(status)) {
    return errorResponse("Trạng thái đơn không hợp lệ", 400);
  }
  if (!validPositiveInteger(page, Number.MAX_SAFE_INTEGER) ||
      !validPositiveInteger(pageSize, 50)) {
    return errorResponse("Tham số phân trang không hợp lệ", 400);
  }

  // Chỉ gửi các tham số API cho phép; không chuyển tiếp tùy ý query từ client.
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page) params.set("page", page);
  if (pageSize) params.set("pageSize", pageSize);
  const search = params.toString();
  const url = `${upstream.replace(/\/+$/, "")}/manager/orders${search ? `?${search}` : ""}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
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
