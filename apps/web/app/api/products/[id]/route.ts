
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const apiUrl = process.env.API_INTERNAL_URL;

  if (!apiUrl) {
    return NextResponse.json(
      { message: "Chưa cấu hình API backend" },
      { status: 503 }
    );
  }

  try {
    const url = `${apiUrl.replace(/\/$/, "")}/products/${encodeURIComponent(id)}`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        ...(request.headers.get("cookie")
          ? { Cookie: request.headers.get("cookie")! }
          : {}),
      },
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      { message: "Không thể kết nối API backend" },
      { status: 502 }
    );
  }
}
