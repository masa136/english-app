import { NextResponse } from "next/server";

// 汎用のAIエンドポイント。page.tsx の全AI機能（添削・解説・問題生成・会話・メール添削）がここを使います。
// 環境変数名は既存の /api/evaluate/route.ts と同じものに合わせてください（ここでは GEMINI_API_KEY）。
export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 8000) {
      return NextResponse.json({ error: "invalid prompt" }, { status: 400 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not set" }, { status: 500 });
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const generationConfig: Record<string, unknown> = {
      temperature: 0.7,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    };
    if (model.includes("2.5")) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig,
        }),
      }
