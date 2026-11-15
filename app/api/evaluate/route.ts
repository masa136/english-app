import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { japanese, userEnglish } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 });
    }

    const prompt = `
あなたは優秀な英語講師です。以下の日本語に対するユーザーの英作文を評価・添削してください。
【日本語】${japanese}
【ユーザーの回答】${userEnglish}

必ず以下のJSONフォーマットのみ（マークダウン記号なし）で返してください：
{
  "isCorrect": trueまたはfalse,
  "modelAnswer": "最も自然な模範解答の英語",
  "betterExpression": "よりネイティブらしい別の言い回し（なければ空文字）",
  "feedback": "修正点や良い点の簡潔なアドバイス（日本語で100文字以内）"
}
`;

    // ネイティブのGeminiエンドポイントに x-goog-api-key ヘッダーで送信（AQ.キー完全対応）
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey.trim(),
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API Error:', data);
      return NextResponse.json(
        { error: data.error?.message || 'Gemini APIでエラーが発生しました' },
        { status: response.status }
      );
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    return NextResponse.json(JSON.parse(cleanJson));
  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json({ error: '添削中にサーバーエラーが発生しました' }, { status: 500 });
  }
}

