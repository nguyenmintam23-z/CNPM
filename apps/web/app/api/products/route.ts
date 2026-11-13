
import { NextResponse } from "next/server";

export async function GET() {
  const apiUrl = process.env.API_INTERNAL_URL;

  if (!apiUrl) {
    return NextResponse.json(
      { message: "Chưa cấu hình API backend" },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(
      `${apiUrl.replace(/\/$/, "")}/products`,
      { cache: "no-store" }
    );

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
