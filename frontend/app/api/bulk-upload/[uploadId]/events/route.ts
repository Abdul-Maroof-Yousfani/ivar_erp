import { NextRequest } from "next/server";
import { getAccessToken } from "@/lib/auth";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ uploadId: string }> }
) {
    try {
        const { uploadId } = await params;
        const token = await getAccessToken();

        if (!token) {
            return new Response(JSON.stringify({ status: false, message: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const uploadType = req.nextUrl.searchParams.get("type") || "item";
        let backendPath: string;

        if (uploadType === "hscode") {
            backendPath = `${API_URL}/master/hs-codes/bulk-upload/${uploadId}/events`;
        } else if (uploadType === "employee") {
            backendPath = `${API_URL}/employees/bulk-upload/${uploadId}/events`;
        } else if (uploadType === "attendance") {
            backendPath = `${API_URL}/attendances/bulk-upload/${uploadId}/events`;
        } else {
            backendPath = `${API_URL}/items/bulk-upload/${uploadId}/events`;
        }

        let backendRes: Response;
        try {
            backendRes = await fetch(backendPath, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "text/event-stream",
                    "Cache-Control": "no-cache",
                },
                // Next.js fetch cache must be disabled for streaming
                cache: "no-store",
            });
        } catch (fetchErr: any) {
            // Backend unreachable — return a proper SSE error event so the client
            // can read it and decide whether to retry
            const errorPayload = `data: ${JSON.stringify({ type: "failed", data: { message: "Backend unreachable: " + fetchErr.message } })}\n\n`;
            return new Response(errorPayload, {
                status: 200,
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache, no-transform",
                    "X-Accel-Buffering": "no",
                },
            });
        }

        if (!backendRes.ok || !backendRes.body) {
            const errorPayload = `data: ${JSON.stringify({ type: "failed", data: { message: `Backend returned ${backendRes.status}` } })}\n\n`;
            return new Response(errorPayload, {
                status: 200, // Keep 200 so EventSource doesn't permanently close
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache, no-transform",
                    "X-Accel-Buffering": "no",
                },
            });
        }

        return new Response(backendRes.body, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
                "X-Accel-Buffering": "no",
            },
        });
    } catch (err: any) {
        // Catch-all — never let the route throw a 500
        const errorPayload = `data: ${JSON.stringify({ type: "failed", data: { message: err?.message || "Proxy error" } })}\n\n`;
        return new Response(errorPayload, {
            status: 200,
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
            },
        });
    }
}
