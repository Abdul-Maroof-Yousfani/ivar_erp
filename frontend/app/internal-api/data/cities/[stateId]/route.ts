import { NextResponse, NextRequest } from "next/server";
import { getAccessToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

export async function GET(req: NextRequest, ctx: any) {
  try {
    // In some Next.js versions `ctx.params` can be a Promise. Ensure it's unwrapped.
    const params = await (ctx?.params || {});

    const token = await getAccessToken();
    const headers: HeadersInit = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const stateId = params?.stateId;
    if (!stateId) {
      return NextResponse.json({ status: false, data: [], message: "stateId is required" }, { status: 400 });
    }

    const res = await fetch(`${API_BASE}/cities/state/${stateId}`, { headers, cache: "no-store" });
    const json = await res.json();
    return NextResponse.json(json);
  } catch (error: any) {
    return NextResponse.json({ status: false, data: [], message: error?.message || "Failed to load cities" }, { status: 500 });
  }
}
