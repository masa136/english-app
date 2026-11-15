"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Send, Volume2, Sparkles, CheckCircle2, XCircle, RotateCcw, Play, Pause, ChevronRight } from 'lucide-react';

const QUESTION_BANK: Record<string, { jp: string }[]> = {
  "中学文法・基本": [
    { jp: "私は昨日、駅で彼に会いました。" },
    { jp: "この本は彼女によって書かれました。" },
    { jp: "あなたはどのくらい英語を勉強していますか？" },
    { jp: "もし明日晴れれば、私たちは公園に行きます。" },
    { jp: "私は音楽を聴きながら走ることが好きです。" }
  ],
  "日常会話・フレーズ": [
    { jp: "お時間を取っていただきありがとうございます。" },
    { jp: "駅までどうやって行けばいいか教えてもらえますか？" },
    { jp: "そろそろ行かなければなりません。" },
    { jp: "それはいい考えですね！" },
    { jp: "もう一度言っていただけますか？" }
  ],
  "ビジネス・丁寧表現": [
    { jp: "添付のファイルをご確認ください。" },
    { jp: "来週の火曜日に会議を設定しましょう。" },
    { jp: "返信が遅れて申し訳ありません。" },
    { jp: "その件については後ほど折り返しご連絡します。" },
    { jp: "何かご質問があればお知らせください。" }
  ]
};

export default function Home() {
  const categories = Object.keys(QUESTION_BANK);
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  
  // タイマー機能
  const [timeLeft, setTimeLeft] = useState(15);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  const questions = QUESTION_BANK[selectedCategory];
  const currentQ = questions[currentIndex];

  const speakEnglish = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }, []);

  // カウントダウンタイマーの処理
  useEffect(() => {
    if (!isTimerRunning || evaluation) return;
    if (timeLeft <= 0) {
      setIsTimerRunning(false);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isTimerRunning, evaluation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim() || loading) return;

    setLoading(true);
    setIsTimerRunning(false);

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
      alert('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setUserAnswer('');
    setEvaluation(null);
    setTimeLeft(15);
    setIsTimerRunning(true);
    setCurrentIndex((prev) => (prev + 1) % questions.length);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setCurrentIndex(0);
    setUserAnswer('');
    setEvaluation(null);
    setTimeLeft(15);
    setIsTimerRunning(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between max-w-md mx-auto select-none font-sans">
      {/* ヘッダー＆カテゴリー選択 */}
      <header className="bg-white border-b border-slate-200 px-4 pt-3 pb-3 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h1 className="font-bold text-base tracking-tight text-slate-800">AI瞬間英作文トレーナー</h1>
          </div>
          <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">
            Q.{currentIndex + 1} / {questions.length}
          </span>
        </div>

        {/* 横スクロールカテゴリータブ */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 active:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* メインカードエリア */}
      <main className="flex-1 px-4 py-4 flex flex-col justify-center gap-4">
        {/* タイマーバー */}
        <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500">制限時間</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="text-indigo-600"
            >
              {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <span className={`tabular-nums text-sm font-bold ${timeLeft <= 3 && !evaluation ? 'text-rose-600 animate-pulse' : 'text-slate-700'}`}>
              {timeLeft}秒
            </span>
          </div>
        </div>

        {/* 日本語問題カード */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm text-center relative">
          <span className="text-xs font-bold text-indigo-500 mb-2 block tracking-wider">声に出して英訳しよう</span>
          <p className="text-xl font-bold leading-relaxed text-slate-800">
            {currentQ.jp}
          </p>
        </div>

        {/* 入力フォーム または AI添削結果 */}
        {!evaluation ? (
          <form onSubmit={handleSubmit} className="space-y-3">
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
          <div className="space-y-3 animate-fadeIn">
            <div className={`p-5 rounded-3xl border ${evaluation.isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-amber-50 border-amber-200 text-amber-950'}`}>
              <div className="flex items-center gap-2 font-extrabold text-base mb-2">
                {evaluation.isCorrect ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Great! よくできました
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-amber-600" /> もう一歩！
                  </>
                )}
              </div>

              <div className="space-y-2 text-xs bg-white/90 p-3.5 rounded-2xl border border-black/5">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block">模範解答</span>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="font-bold text-sm text-indigo-950">{evaluation.modelAnswer}</span>
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
                    <span className="text-[10px] font-bold text-slate-500 block">より自然な表現</span>
                    <span className="font-medium text-slate-800">{evaluation.betterExpression}</span>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-bold text-slate-500 block">AIアドバイス</span>
                  <p className="text-slate-700 leading-relaxed">{evaluation.feedback}</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleNext}
              className="w-full py-4 bg-slate-800 active:bg-slate-900 text-white font-bold text-base rounded-2xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
            >
              <RotateCcw className="w-5 h-5" /> 次の問題へ進む
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-400 py-3 border-t border-slate-100">
        Powered by Google Gemini API
      </footer>
    </div>
  );
}
