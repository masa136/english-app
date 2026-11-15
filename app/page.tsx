
'client';
import React, { useState, useCallback } from 'react';
import { Send, Volume2, Sparkles, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

const QUESTIONS = [
  { id: 1, jp: "私は昨日、駅で彼に会いました。" },
  { id: 2, jp: "この本は彼女によって書かれました。" },
  { id: 3, jp: "お時間を取っていただきありがとうございます。" },
  { id: 4, jp: "駅までどうやって行けばいいか教えてもらえますか？" },
  { id: 5, jp: "もし明日晴れれば、私たちは公園に行きます。" }
];

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);

  const currentQ = QUESTIONS[currentIndex];

  const speakEnglish = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim() || loading) return;

    setLoading(true);
    setEvaluation(null);

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ japanese: currentQ.jp, userEnglish: userAnswer }),
      });
      const data = await res.json();
      if (res.ok) {
        setEvaluation(data);
        if (data.modelAnswer) {
          speakEnglish(data.modelAnswer);
        }
      } else {
        alert(data.error || 'エラーが発生しました');
      }
    } catch (err) {
      console.error(err);
      -alert('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setUserAnswer('');
    setEvaluation(null);
    setCurrentIndex((prev) => (prev + 1) % QUESTIONS.length);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between max-w-md mx-auto p-4 font-sans">
      <header className="flex items-center justify-between py-3 border-b border-slate-200">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <h1 className="font-bold text-base text-slate-800">AI瞬間英作文 (Gemini)</h1>
        </div>
        <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">
          Q.{currentIndex + 1} / {QUESTIONS.length}
        </span>
      </header>

      <main className="flex-1 py-6 flex flex-col gap-5 justify-center">
        {/* 問題カード */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm text-center">
          <span className="text-xs font-bold text-indigo-500 mb-2 block tracking-wider">この日本語を英語にしよう</span>
          <p className="text-xl font-bold text-slate-800 leading-relaxed">{currentQ.jp}</p>
        </div>

        {/* 入力フォーム */}
        {!evaluation ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="ここに英語を入力（例: I met him...）"
              rows={3}
              className="w-full p-4 rounded-2xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 text-base bg-white shadow-xs"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 active:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-lg rounded-2xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
            >
              {loading ? (
                <span className="animate-pulse">AIが添削中...</span>
              ) : (
                <>
                  <Send className="w-5 h-5" /> 提出してAIに判定してもらう
                </>
              )}
            </button>
          </form>
        ) : (
          /* 判定・添削結果表示エリア */
          <div className="space-y-4 animate-fadeIn">
            <div className={`p-5 rounded-3xl border ${evaluation.isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-amber-50 border-amber-200 text-amber-950'}`}>
              <div className="flex items-center gap-2 font-extrabold text-lg mb-2">
                {evaluation.isCorrect ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" /> Great! よくできました
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6 text-amber-600" /> もう一歩！
                  </>
                )}
              </div>

              <div className="space-y-2 text-sm bg-white/80 p-4 rounded-2xl border border-black/5">
                <div>
                  <span className="text-xs font-bold text-slate-500 block">模範解答</span>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="font-bold text-base text-indigo-950">{evaluation.modelAnswer}</span>
                    <button
                      onClick={() => speakEnglish(evaluation.modelAnswer)}
                      aria-label="英語を読み上げる"
                      className="p-2 bg-indigo-600 text-white rounded-xl active:scale-95 shrink-0"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {evaluation.betterExpression && (
                  <div>
                    <span className="text-xs font-bold text-slate-500 block">より自然な表現</span>
                    <span className="font-medium text-slate-800">{evaluation.betterExpression}</span>
                  </div>
                )}

                <div>
                  <span className="text-xs font-bold text-slate-500 block">AIアドバイス</span>
                  <p className="text-slate-700 leading-relaxed">{evaluation.feedback}</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleNext}
            className="w-full py-4 bg-slate-800 active:bg-slate-900 text-white font-bold text-base rounded-2xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
            >
              <RotateCcw className="w-5 h-5" /> 次の問題へ進む
            </button>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-400 py-2">
        Powered by Google Gemini API (Free Tier)
      </footer>
    </div>
  );
}
