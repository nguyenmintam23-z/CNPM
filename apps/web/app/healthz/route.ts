import { NextResponse } from "next/server";

// Web liveness smoke test: publicly reachable, independent of auth and database.
export function GET() {
  return NextResponse.json(
    { status: "ok" },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
