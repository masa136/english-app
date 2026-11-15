import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "APIキー（GEMINI_API_KEY）がVercelに設定されていません" }, { status: 500 });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey.trim(),
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);
      const errMsg = data.error?.message || "Gemini APIでエラーが発生しました";
      return NextResponse.json({ error: `APIエラー: ${errMsg}` }, { status: response.status });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: `サーバーエラー: ${error.message || "不明"}` }, { status: 500 });
  }
}
