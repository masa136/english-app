import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "invalid prompt" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "APIキーが設定されていません" }, { status: 500 });
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
          generationConfig: {
            temperature: 0.7,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);
      return NextResponse.json(
        { error: data.error?.message || "Gemini API error" },
        { status: response.status }
      );
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // 【重要】Geminiが返すマークダウン（```json ... ```）や前後の余分な言葉を自動でカットし、純粋なJSON部分だけを抽出する
    let cleanText = rawText.trim();
    const jsonMatch = cleanText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }

    return NextResponse.json({ text: cleanText });
  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
