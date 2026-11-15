import { NextRequest, NextResponse } from "next/server";

/** Proxy chỉ đọc; Backend tự xác thực chủ tài khoản qua HttpOnly cookie. */
export async function GET(request: NextRequest) {
  const upstream = process.env.API_UPSTREAM_URL;
  if (!upstream) return NextResponse.json({ message: "Chưa cấu hình API Backend" }, { status: 503 });
  const page = request.nextUrl.searchParams.get("page") ?? "1";
  const pageSize = request.nextUrl.searchParams.get("pageSize") ?? "20";
  if (!/^[1-9]\d*$/.test(page) || !/^[1-9]\d*$/.test(pageSize) ||
      !Number.isSafeInteger(Number(page)) || !Number.isSafeInteger(Number(pageSize)) ||
      Number(pageSize) > 50) {
    return NextResponse.json({ message: "Phân trang không hợp lệ" }, { status: 400 });
  }
  const params = new URLSearchParams({ page, pageSize });
  try {
    const response = await fetch(`${upstream.replace(/\/$/, "")}/orders?${params}`, {
      headers: { Cookie: request.headers.get("cookie") ?? "" }, cache: "no-store",
    });
    const payload: unknown = await response.json().catch(() => null);
    const result = NextResponse.json(payload, { status: response.status,
      headers: { "Cache-Control": "no-store" } });
    for (const cookie of response.headers.getSetCookie()) result.headers.append("Set-Cookie", cookie);
    return result;
  } catch {
    return NextResponse.json({ message: "Không thể kết nối API Backend" }, { status: 502 });
  }
}
