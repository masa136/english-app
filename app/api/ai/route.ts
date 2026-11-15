import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "invalid prompt" }, { status: 400 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not set" }, { status: 500 });
    }

    // 環境変数やモデル名に混ざった余分なスペース・改行を .trim() で完全に除去
    const model = (process.env.GEMINI_MODEL || "gemini-1.5-flash").trim();
    const cleanKey = key.trim();

    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const r = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": cleanKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("Gemini API error details:", data);
      return NextResponse.json(
        { error: data?.error?.message || "Gemini API error" },
        { status: 502 }
      );
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) {
      return NextResponse.json({ error: "empty response" }, { status: 502 });
    }

    return NextResponse.json({ text });
  } catch (e: any) {
    console.error("Server execution error:", e?.message || e);
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
