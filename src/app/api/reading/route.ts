import { NextResponse } from "next/server";
import { requestSchema } from "@/lib/validation";
import { AIError, analyzeWithAI } from "@/services/ai";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const origin = request.headers.get("origin");
    // Next.js may build request.url with its listening hostname, which can
    // differ from the browser's hostname. Host identifies the requested site.
    const requestUrl = new URL(request.url);
    const host = request.headers.get("host");
    const expectedOrigin = host
      ? new URL(`${requestUrl.protocol}//${host}`).origin
      : requestUrl.origin;
    if (origin && origin !== expectedOrigin)
      return NextResponse.json(
        { error: "Nguồn yêu cầu không hợp lệ." },
        { status: 403, headers },
      );
    if (!request.headers.get("content-type")?.includes("application/json"))
      return NextResponse.json(
        { error: "Yêu cầu phải là JSON." },
        { status: 415, headers },
      );
    const body = await request.text();
    if (body.length > 50000)
      return NextResponse.json(
        { error: "Dữ liệu yêu cầu quá lớn." },
        { status: 413, headers },
      );
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { error: "JSON không hợp lệ." },
        { status: 400, headers },
      );
    }
    const parsed = requestSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400, headers },
      );
    // Client-supplied meanings are stripped by validation; the AI service uses
    // only canonical server-side data and validates the returned card identities.
    const analysis = await analyzeWithAI(parsed.data, request.signal);
    return NextResponse.json({ analysis, source: "ai" }, { headers });
  } catch (error) {
    if (error instanceof AIError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers },
      );
    return NextResponse.json(
      {
        error:
          "Không thể phân tích lúc này. Các lá đã rút vẫn được giữ nguyên.",
      },
      { status: 500, headers },
    );
  }
}
