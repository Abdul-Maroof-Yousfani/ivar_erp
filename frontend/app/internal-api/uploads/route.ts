import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

export async function POST(req: NextRequest) {
  try {
    const token = await getAccessToken();
    const incoming = await req.formData();
    const fd = new FormData();
    const file = incoming.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ status: false, message: "No file provided" }, { status: 400 });
    }
    const name = (file as any).name || "upload";
    fd.append("file", file, name);

    const res = await fetch(`${API_BASE}/uploads`, {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: fd,
    });

    const json = await res.json();
    if (!json.status) {
      return NextResponse.json(json, { status: res.status });
    }
    // Convert relative URL to absolute URL if needed
    const id = json.data?.id;
    let url = json.data?.url;
    if (url && url.startsWith('/')) {
      // Convert relative URL to absolute
      const backendUrl = API_BASE.replace('/api', '');
      url = `${backendUrl}${url}`;
    } else if (!url) {
      // Fallback: generate URL
      url = `${API_BASE}/uploads/${id}`;
    }
    return NextResponse.json({ status: true, data: { ...json.data, url } });
  } catch (error: any) {
    return NextResponse.json({ status: false, message: error?.message || "Upload failed" }, { status: 500 });
  }
}
