"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Volume2, Mic, Square, HelpCircle, RotateCcw, CheckCircle2, ChevronRight,
  Play, Pause, Star, Menu, ArrowLeft, Sparkles,
} from "lucide-react";

/* ───────── 型 ───────── */
type Q = [string, string, string]; // [和文, 英文, ポイント]
type Mode = "think" | "speak" | "read" | "shadow";
type View = "quiz" | "menu" | "stats" | "scene" | "fav" | "chat" | "mail" | "set";
type Item = { q: Q; miss: number; step: number; due?: number };
type P = {
  deck: Record<string, Item>; later: Record<string, Item>;
  mastered: Record<string, boolean>; hist: any[]; weak: string[]; lvl: number;
  log: Record<string, { n: number; ok: number }>; fav: Record<string, Q>;
  scene: string; noauto: boolean; voice: string; rate: number;
};
const P0: P = {
  deck: {}, later: {}, mastered: {}, hist: [], weak: [], lvl: 2.5,
  log: {}, fav: {}, scene: "", noauto: false, voice: "en-US", rate: 1,
};

/* ───────── 定数 ───────── */
const ADP = "🎯 あなた専用", REV = "🔁 復習", GEN = "♾️ AI無限出題";
const INT = [1, 3, 7]; // 復習間隔（日）
const RATES = [0.6, 0.75, 1, 1.25];
const SCENES = ["メール", "会議", "電話対応", "商談・交渉", "社内報告・相談", "スケジュール調整", "クレーム対応", "出張・接待", "プレゼン", "チームマネジメント", "取引先とのやり取り", "オンライン会議"];
const BANK: Record<string, Q[]> = {
  "メール・書面": [
    ["添付のファイルをご確認ください。", "Please check the attached file.", "attached（添付された）という過去分詞が後ろの file を修飾します。"],
    ["返信が遅れて申し訳ありません。", "I apologize for the late reply.", "ビジネスでは I’m sorry より I apologize for ~ が丁寧です。"],
    ["ご連絡いただきありがとうございます。", "Thank you for getting in touch.", "get in touch で「連絡を取る」。Thank you for -ing の形で感謝を伝えます。"],
    ["資料を明日までにお送りします。", "I will send you the materials by tomorrow.", "期限を表す「〜までに」は by、ずっと続く「〜まで」は until です。"],
    ["何かご質問があればお知らせください。", "Please let me know if you have any questions.", "let 人 know（人に知らせる）を使った結びの定番フレーズです。"],
  ],
  "会議・商談": [
    ["来週の火曜日に会議を設定しましょう。", "Let’s schedule a meeting for next Tuesday.", "日時を指定して予定を入れる際は前置詞 for を使います。"],
    ["会議の議題を共有していただけますか？", "Could you share the agenda for the meeting?", "agenda は「議題」。Could you ~? は丁寧な依頼の表現です。"],
    ["その点については同意見です。", "I agree with you on that point.", "agree with 人 で「人に同意する」。on ~ で話題を示します。"],
    ["予算について確認させてください。", "Let me confirm the budget.", "Let me + 動詞の原形 で「〜させてください」と申し出ます。"],
    ["納期に間に合うよう最善を尽くします。", "I will do my best to meet the deadline.", "meet the deadline で「納期に間に合わせる」という意味です。"],
  ],
  "電話・日常業務": [
    ["その件については後ほど折り返しご連絡します。", "I will get back to you on that later.", "get back to 人 で「（人に）折り返し連絡する」という頻出句動詞です。"],
    ["少々お待ちいただけますか？", "Could you hold on for a moment?", "hold on は電話で「そのままお待ちください」という意味になります。"],
    ["担当者におつなぎします。", "I will transfer you to the person in charge.", "transfer 人 to ~ で電話を「転送する」。person in charge は「担当者」です。"],
    ["明日は終日外出しております。", "I will be out of the office all day tomorrow.", "out of the office で「外出中・不在」。all day は「終日」です。"],
    ["進捗状況を随時お知らせします。", "I will keep you updated on our progress.", "keep 人 updated で「人に最新情報を伝え続ける」という意味です。"],
  ],
};

/* ───────── ユーティリティ ───────── */
const day = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function ai(prompt: string): Promise<string> {
  const r = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "AI error");
  return d.text as string;
}

const parseJ = (t: string) => {
  try {
    // マークダウンの装飾（```json など）を完全に除去
    const clean = t.replace(/```json/gi, "").replace(/```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    // 万が一テキストが混ざっていても、配列やオブジェクトの部分だけを強制的に切り出す
    const m = t.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {}
    }
    console.error("AI Response parse error:", t);
    throw new Error("Invalid JSON format");
  }
};

function words(s: string) {
  return s.replace(/’/g, "'").replace(/'ll\b/gi, " will").split(/\s+/)
    .map((w) => ({ d: w, n: w.toLowerCase().replace(/[^a-z0-9']/g, ""), ok: false }))
    .filter((x) => x.n);
}
function diff(a: string, h: string) {
  const A = words(a), H = words(h), n = A.length, m = H.length;
  const L = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = A[i].n === H[j].n ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i].n === H[j].n) { A[i].ok = H[j].ok = true; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  return { A, H, score: Math.round((200 * L[0][0]) / (n + m || 1)) };
}

/* 復習の間隔反復：deck=今日復習、later=復習待ち */
function wakeP(p: P): P {
  const now = Date.now();
  let deck = p.deck, later = p.later, ch = false;
  for (const k in p.later) {
    if ((p.later[k].due || 0) <= now) {
      if (!ch) { deck = { ...deck }; later = { ...later }; ch = true; }
      deck[k] = later[k]; delete later[k];
    }
  }
  return ch ? { ...p, deck, later } : p;
}
function trackP(p: P, q: Q, ok: boolean): P {
  const k = q[0], d = p.deck[k] || p.later[k];
  const deck = { ...p.deck }, later = { ...p.later };
  delete deck[k]; delete later[k];
  if (!ok) { deck[k] = { q, miss: (d?.miss || 0) + 1, step: 0 }; return { ...p, deck, later }; }
  if (!d) return p;
  const st = (d.step || 0) + 1;
  if (st <= INT.length) later[k] = { q, miss: d.miss, step: st, due: Date.now() + INT[st - 1] * 864e5 };
  return { ...p, deck, later };
}

/* ───────── プロンプト ───────── */
const reviewPrompt = (q: Q, t: string) => `あなたは日本人学習者向けのビジネス英語コーチです。次の和文を英訳した学習者の回答を、複数の観点で添削してください。
和文: ${q[0]}
模範解答: ${q[1]}
学習者の回答: ${t}
※回答は音声入力のため、大文字小文字や句読点の欠落は無視してください。模範解答と違っても、正しく自然ならそのまま評価してください。
JSONのみで返答してください:
{"verdict":"一言の総評","grammar":{"rating":"◎か○か△か×","comment":"文法上の誤りと理由。なければその旨"},"meaning":{"rating":"同上","comment":"和文の意味を正しく伝えているか"},"business":{"rating":"同上","comment":"ビジネスでの丁寧さ・トーン・場面への適切さ。カジュアルすぎる点や硬すぎる点"},"vocab":{"rating":"同上","comment":"語彙・コロケーションの適切さ"},"fixed":"学習者の意図を活かしてビジネスで通用する形に直した英文","alternatives":[{"en":"別の言い方","note":"ニュアンスの違い"},{"en":"別の言い方","note":"ニュアンスの違い"}],"tip":"次に活かせる具体的アドバイス"}
各commentは日本語で2〜3文、具体的に書いてください。`;

const explainPrompt = (q: Q) => `あなたは日本人学習者向けのビジネス英語コーチです。次の例文を詳しく解説してください。
和文: ${q[0]}
英文: ${q[1]}
基本解説: ${q[2]}
JSONのみで返答してください:
{"grammar":"文法・語順のポイントを段階的に詳しく（3〜5文）","words":[{"w":"重要な表現","m":"意味と使い方"}],"business":"どんな場面・相手で使うか、トーンや丁寧さ（2〜3文）","levels":[{"label":"カジュアル","en":"英文"},{"label":"標準","en":"英文"},{"label":"フォーマル","en":"英文"}],"mistakes":"日本人がやりがちな間違いと対処法（2〜3文）","dialog":"短い使用例（英文と日本語訳）"}
wordsは3〜4個、すべて日本語で具体的に。`;

const GEN_JSON = `JSON配列のみで返答してください:
[{"jp":"和文","en":"自然なビジネス英文","point":"文法・表現のポイントを日本語で2〜3文"}]`;

const genPrompt = (seen: Q[], scene: string) => {
  const sc = scene || [...SCENES].sort(() => Math.random() - 0.5).slice(0, 2).join("、");
  return `あなたはビジネス英語の教材作成者です。日本人学習者向けの瞬間英作文の問題を5問作ってください。
場面: ${sc}
条件: 実際のビジネスで使える自然で丁寧な文。中級レベル（英文は8〜16語）。問題ごとに異なる文法・表現を使うこと。次の既出文と重複・類似しないこと: ${seen.slice(-20).map((x) => x[1]).join(" / ") || "なし"}
${GEN_JSON}`;
};

const adaptPrompt = (seen: Q[], p: P) => {
  const sc = p.scene || [...SCENES].sort(() => Math.random() - 0.5).slice(0, 2).join("、");
  const rec = p.hist.slice(-10);
  const rate = rec.length ? Math.round((100 * rec.filter((h) => h.ok).length) / rec.length) + "%" : "データなし";
  const miss = p.hist.filter((h) => !h.ok).slice(-6)
    .map((h) => `和文「${h.jp}」模範「${h.en}」→学習者「${h.u || "（答えを見た）"}」`).join("\n") || "なし";
  const lv = p.lvl.toFixed(1);
  return `あなたは日本人学習者専属のビジネス英語コーチです。この学習者に合わせた瞬間英作文の問題を5問作ってください。
【学習者データ】
現在レベル: ${lv}（1=中学基礎の短文 2=初級ビジネス 3=中級 4=中上級 5=上級：仮定法・婉曲・交渉表現）
直近10問の正答率: ${rate}
最近の間違い:
${miss}
指摘された弱点: ${p.weak.join(" / ") || "なし"}
復習中の文: ${Object.values(p.deck).slice(-5).map((d) => d.q[1]).join(" / ") || "なし"}
【出題方針】
・5問のうち3問は上記の弱点・間違いに関連する文法/表現を使った、別の新しい文にする
・残り2問はレベル${lv}ちょうどの新しい文にする（正答率が高ければ少し難しく、低ければやさしく）
・場面は ${sc}
・実際のビジネスで使える自然で丁寧な文。次の既出文と重複・類似しないこと: ${seen.slice(-20).map((x) => x[1]).join(" / ") || "なし"}
${GEN_JSON.replace("文法・表現のポイントを日本語で2〜3文", "文法・表現のポイントと、この学習者の弱点との関係を日本語で2〜3文")}`;
};

/* ───────── 小さな表示部品 ───────── */
const CARD = "bg-white rounded-2xl border border-slate-200 p-4";
const BTN = "w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-50";
const PRI = `${BTN} bg-indigo-600 active:bg-indigo-700 text-white shadow-md`;
const SEC = `${BTN} bg-slate-100 active:bg-slate-200 text-slate-700`;
const OKB = `${BTN} bg-emerald-600 active:bg-emerald-700 text-white shadow-md`;
const INP = "w-full p-3 rounded-xl border border-slate-300 bg-white text-base focus:outline-hidden focus:ring-2 focus:ring-indigo-600 select-text";

function Header({ children }: { children: React.ReactNode }) {
  return <header className="bg-white border-b border-slate-200 px-4 pt-3 pb-3 sticky top-0 z-10">{children}</header>;
}
function Sec({ t, badge, children }: { t: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <h4 className="text-[13px] font-bold flex items-center gap-1.5">
        {t}
        {badge && <span className="px-1.5 rounded-md bg-indigo-50 text-indigo-600">{badge}</span>}
      </h4>
      {children}
    </div>
  );
}
function EN({ t, say }: { t: string; say: (t: string) => void }) {
  return (
    <p>
      <span className="font-bold text-indigo-600">{t}</span>
      <button onClick={() => say(t)} aria-label="発音" className="ml-1.5 p-1 rounded-lg bg-slate-100 align-middle">
        <Volume2 className="w-3.5 h-3.5" />
      </button>
    </p>
  );
}
function AiBox({ title, x, retry, render }: { title: string; x: any; retry: () => void; render: (d: any) => React.ReactNode }) {
  return (
    <div className={`${CARD} text-sm leading-relaxed select-text`}>
      <span className="block text-xs font-bold text-slate-500 mb-1">{title}</span>
      {x.st === "load" ? (
        <p className="text-slate-500 animate-pulse">作成中…</p>
      ) : x.st === "err" ? (
        <>
          <p className="text-slate-500">うまくいきませんでした。</p>
          <button onClick={retry} className="mt-2 px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold">もう一度</button>
        </>
      ) : render(x.d)}
    </div>
  );
}
function ReviewBody({ d, say }: { d: any; say: (t: string) => void }) {
  const rows: [string, any][] = [["📐 文法", d.grammar], ["🎯 意味の正確さ", d.meaning], ["💼 ビジネスでの適切さ", d.business], ["🔤 語彙・表現", d.vocab]];
  const alts: any[] = Array.isArray(d.alternatives) ? d.alternatives : [];
  return (
    <>
      <p className="font-bold">{d.verdict}</p>
      {rows.map(([t, r]) => r && <Sec key={t} t={t} badge={r.rating}><p>{r.comment}</p></Sec>)}
      {d.fixed && <Sec t="✅ ビジネス向けに直すと"><EN t={d.fixed} say={say} /></Sec>}
      {alts.length > 0 && (
        <Sec t="🔁 別の言い方">
          {alts.map((a, i) => <div key={i} className="mb-1"><EN t={a.en} say={say} /><p className="text-slate-500">{a.note}</p></div>)}
        </Sec>
      )}
      {d.tip && <Sec t="💡 アドバイス"><p>{d.tip}</p></Sec>}
    </>
  );
}
function ExplainBody({ d, say }: { d: any; say: (t: string) => void }) {
  const w: any[] = Array.isArray(d.words) ? d.words : [], lv: any[] = Array.isArray(d.levels) ? d.levels : [];
  return (
    <>
      <Sec t="📐 文法ポイント"><p>{d.grammar}</p></Sec>
      <Sec t="📖 重要表現">{w.map((a, i) => <p key={i}><b className="text-indigo-600">{a.w}</b>　{a.m}</p>)}</Sec>
      <Sec t="💼 ビジネスでの使いどころ"><p>{d.business}</p></Sec>
      <Sec t="🎚 丁寧さ別の言い換え">{lv.map((a, i) => <div key={i}><span className="text-slate-500 text-xs">{a.label}</span><EN t={a.en} say={say} /></div>)}</Sec>
      <Sec t="⚠️ よくある間違い"><p>{d.mistakes}</p></Sec>
      <Sec t="💬 使用例"><p>{d.dialog}</p></Sec>
    </>
  );
}

/* ───────── 本体 ───────── */
export default function Home() {
  const [p, setP] = useState<P>(P0);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("quiz");
  const [cat, setCat] = useState(ADP);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<Mode>("speak");
  const [show, setShow] = useState(false);
  const [t, setT] = useState(20);
  const [running, setRunning] = useState(true);
  const [res, setRes] = useState<any>(null);
  const [lastText, setLastText] = useState("");
  const [typed, setTyped] = useState("");
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState("");
  const [rv, setRv] = useState<any>(null);
  const [ex, setEx] = useState<Record<string, any>>({});
  const [exS, setExS] = useState<any>(null);
  const [gen, setGen] = useState<Q[]>([]);
  const [adp, setAdp] = useState<Q[]>([]);
  const [rev, setRev] = useState<Q[]>([]);
  const [gl, setGl] = useState({ gen: false, adp: false });
  const [ge, setGe] = useState({ gen: "", adp: "" });
  const [rep, setRep] = useState<any>(null);
  const [sceneIn, setSceneIn] = useState("");
  const [chat, setChat] = useState<any>(null);
  const [chatSc, setChatSc] = useState("");
  const [chatIn, setChatIn] = useState("");
  const [mailIn, setMailIn] = useState("");
  const [mailPu, setMailPu] = useState("");
  const [mailRes, setMailRes] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const recRef = useRef<any>(null);
  const curRef = useRef("");
  const pRef = useRef<P>(P0);
  const genRef = useRef<Q[]>([]);
  const adpRef = useRef<Q[]>([]);
  const busy = useRef({ gen: false, adp: false });
  const tabsRef = useRef<HTMLDivElement>(null);

  const tabs = [ADP, REV, GEN, ...Object.keys(BANK)];
  const qs: Q[] = cat === ADP ? adp : cat === REV ? rev : cat === GEN ? gen : BANK[cat] || [];
  const q = qs[idx] as Q | undefined;
  const shown = mode === "read" || mode === "shadow" || show;
  const hasTimer = mode === "think" || mode === "speak";
  curRef.current = q ? q[0] : "";
  pRef.current = p;
  genRef.current = gen;
  adpRef.current = adp;

  /* 保存・読み込み */
  useEffect(() => {
    try {
      const j = JSON.parse(localStorage.getItem("eisaku-v1") || "{}");
      setP(wakeP({ ...P0, ...j }));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem("eisaku-v1", JSON.stringify(p)); } catch {}
  }, [p, ready]);

  /* 選択中のタブを見える位置へ */
  useEffect(() => {
    const tb = tabsRef.current, on = tb?.querySelector<HTMLElement>("[data-on]");
    if (tb && on) tb.scrollLeft = Math.max(0, on.offsetLeft - 16);
  }, [cat, view]);

  /* 音声 */
  function speak(text: string) {
    try {
      const s = window.speechSynthesis;
      s.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = p.voice; u.rate = p.rate;
      const v = s.getVoices().find((x) => x.lang.replace("_", "-") === p.voice);
      if (v) u.voice = v;
      s.speak(u);
    } catch {}
  }
  function stopRec() {
    const r = recRef.current;
    if (r) { r.onresult = r.onerror = r.onend = null; try { r.abort(); } catch {} }
    recRef.current = null;
    setListening(false);
  }
  function startRec() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setErr("このブラウザは音声認識に対応していません。入力欄をご利用ください。"); return; }
    try { window.speechSynthesis.cancel(); } catch {}
    const r = new SR();
    r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1;
    let got = false;
    r.onresult = (e: any) => { got = true; check(e.results[0][0].transcript); };
    r.onerror = (e: any) => {
      setListening(false);
      setErr(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "マイクが許可されていません。ブラウザの設定でマイクを許可してください。"
          : e.error === "no-speech" ? "声が聞こえませんでした。もう一度話してください。"
          : e.error === "aborted" ? "" : "音声認識に失敗しました。入力欄も使えます。"
      );
    };
    r.onend = () => { setListening(false); if (!got) setErr((x) => x || "声が聞こえませんでした。もう一度話してください。"); };
    recRef.current = r;
    setErr(""); setListening(true);
    try { r.start(); } catch { setListening(false); setErr("マイクを開始できませんでした。"); }
  }

  /* 出題の切り替え */
  function resetQ(m: Mode = mode) {
    stopRec();
    setShow(false); setRes(null); setRv(null); setExS(null); setErr(""); setTyped("");
    setT(m === "speak" ? 20 : 10);
    setRunning(m === "think" || m === "speak");
  }
  function buildRev(src: P = pRef.current) {
    const w = wakeP(src);
    setP(w);
    setRev(Object.values(w.deck).sort((a, b) => b.miss - a.miss || Math.random() - 0.5).map((d) => d.q));
  }
  function pickCat(c: string) {
    setCat(c); setIdx(0); resetQ();
    if (c === REV) buildRev();
    setGe({ gen: "", adp: "" });
  }
  function changeMode(m: Mode) { setMode(m); resetQ(m); }
  function go(v: View) { stopRec(); setView(v); }

  /* AI 問題生成 */
    async function genMore(kind: "gen" | "adp") {
    if (busy.current[kind]) return;
    busy.current[kind] = true;
    setGl((s) => ({ ...s, [kind]: true })); setGe((s) => ({ ...s, [kind]: "" }));
    try {
      const seen = kind === "gen" ? genRef.current : adpRef.current;
      const prompt = kind === "gen" ? genPrompt(seen, pRef.current.scene) : adaptPrompt(seen, pRef.current);
      const resText = await ai(prompt);
      const a = parseJ(resText);
      const add: Q[] = (Array.isArray(a) ? a : []).filter((x: any) => x && x.jp && x.en).map((x: any) => [x.jp, x.en, x.point || ""] as Q);
      if (!add.length) throw new Error("AIからのデータが空です");
      (kind === "gen" ? setGen : setAdp)((l) => [...l, ...add]);
    } catch (e: any) { 
      // エラーを隠さず、正確な理由を保持する
      setGe((s) => ({ ...s, [kind]: e?.message || "不明なエラー" })); 
    }
    busy.current[kind] = false;
    setGl((s) => ({ ...s, [kind]: false }));
  }


  
  useEffect(() => {
    if (!ready || view !== "quiz") return;
    if (cat === ADP && !adp.length && !gl.adp && !ge.adp) genMore("adp");
    if (cat === GEN && !gen.length && !gl.gen && !ge.gen) genMore("gen");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view, cat, adp.length, gen.length, ge.adp, ge.gen]);

  /* 出題を進める・記録する */
  function advance() {
    const L = qs.length;
    if (cat === GEN || cat === ADP) {
      const ni = idx + 1;
      setIdx(ni);
      if (L - ni <= 2) genMore(cat === ADP ? "adp" : "gen");
    } else {
      const ni = (idx + 1) % (L || 1);
      setIdx(ni);
      if (cat === REV && ni === 0) buildRev();
    }
    resetQ();
  }
  function next(ok: boolean) {
    if (!q) return;
    const sc = res ? res.score : null, u = res ? lastText : "";
    setP((prev) => {
      let lvl = prev.lvl;
      if (!prev.noauto) {
        let d = ok ? 0.15 : -0.25;
        if (sc != null) d = sc >= 90 ? 0.25 : sc >= 80 ? 0.12 : sc >= 60 ? -0.05 : -0.25;
        lvl = Math.max(1, Math.min(5, +(lvl + d).toFixed(2)));
      }
      const k = day(), l = prev.log[k] || { n: 0, ok: 0 };
      const tp = trackP(prev, q, ok);
      return {
        ...tp, lvl,
        mastered: ok ? { ...tp.mastered, [q[0]]: true } : tp.mastered,
        hist: [...tp.hist, { jp: q[0], en: q[1], u, s: sc, ok }].slice(-40),
        log: { ...tp.log, [k]: { n: l.n + 1, ok: l.ok + (ok ? 1 : 0) } },
      };
    });
    advance();
  }
  function toggleFav() {
    if (!q) return;
    setP((s) => {
      const fav = { ...s.fav };
      if (fav[q[0]]) delete fav[q[0]]; else fav[q[0]] = q;
      return { ...s, fav };
    });
  }

  /* 回答・添削 */
  function reveal() { if (!q) return; setShow(true); setRunning(false); speak(q[1]); }
  function noteWeak(d: any) {
    const add: string[] = [];
    ([["grammar", "文法"], ["business", "ビジネス表現"], ["vocab", "語彙"]] as const).forEach(([k, n]) => {
      const x = d[k];
      if (x && /[△×]/.test(x.rating || "")) add.push(n + ": " + x.comment);
    });
    if (d.tip) add.push("助言: " + d.tip);
    setP((s) => ({ ...s, weak: [...s.weak, ...add].filter((v, i, a) => a.indexOf(v) === i).slice(-8) }));
  }
  async function runReview(qq: Q, text: string) {
    setRv({ st: "load" });
    try {
      const d = parseJ(await ai(reviewPrompt(qq, text)));
      if (curRef.current !== qq[0]) return;
      setRv({ st: "ok", d }); noteWeak(d);
    } catch { if (curRef.current === qq[0]) setRv({ st: "err" }); }
  }
  function check(text: string) {
    if (!q) return;
    stopRec();
    setRes(diff(q[1], text)); setShow(true); setRunning(false); setLastText(text); setRv(null);
    if (mode !== "shadow") runReview(q, text);
  }
  async function explain() {
    if (!q) return;
    const qq = q;
    setExS({ st: "load" });
    try {
      const d = parseJ(await ai(explainPrompt(qq)));
      setEx((e) => ({ ...e, [qq[0]]: d }));
      if (curRef.current === qq[0]) setExS(null);
    } catch { if (curRef.current === qq[0]) setExS({ st: "err" }); }
  }

  /* タイマー */
  useEffect(() => {
    if (view !== "quiz" || !q || show || !running || !hasTimer) return;
    const id = setInterval(() => setT((x) => x - 1), 1000);
    return () => clearInterval(id);
  }, [view, q, show, running, hasTimer]);
  useEffect(() => {
    if (t > 0 || !running || show || !q || view !== "quiz" || !hasTimer) return;
    setRunning(false);
    if (mode === "speak") {
      if (listening) { try { recRef.current?.stop(); } catch {} return; }
      if (typed.trim()) { check(typed.trim()); return; }
    }
    reveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  /* 学習記録 */
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const l = p.log[day(d)] || { n: 0, ok: 0 };
    return { w: "日月火水木金土"[d.getDay()], n: l.n, ok: l.ok };
  });
  const streak = (() => {
    let n = 0; const d = new Date();
    if (!p.log[day(d)]?.n) d.setDate(d.getDate() - 1);
    while (p.log[day(d)]?.n) { n++; d.setDate(d.getDate() - 1); }
    return n;
  })();
  async function weakReport() {
    setRep({ st: "load" });
    try {
      const rec = p.hist.slice(-10);
      const rate = rec.length ? Math.round((100 * rec.filter((h) => h.ok).length) / rec.length) + "%" : "データなし";
      const miss = p.hist.filter((h) => !h.ok).slice(-8).map((h) => `和文「${h.jp}」模範「${h.en}」→学習者「${h.u || "（答えを見た）"}」`).join("\n") || "なし";
      const d = parseJ(await ai(`あなたは日本人学習者専属のビジネス英語コーチです。次の学習データから弱点レポートを作ってください。
現在レベル: Lv.${p.lvl.toFixed(1)}（1〜5）
直近${rec.length}問の正答率: ${rate}
連続学習: ${streak}日
最近の間違い:
${miss}
AI添削で指摘された点: ${p.weak.join(" / ") || "なし"}
復習待ちの文: ${Object.values(p.deck).slice(-6).map((x) => x.q[1]).join(" / ") || "なし"}
データが少ない場合は、その旨と今後の進め方を書いてください。
JSONのみで返答してください:
{"summary":"総評（日本語3文）","strengths":["得意なこと"],"weaknesses":[{"area":"分野","detail":"具体的な傾向","drill":"おすすめの練習方法"}],"plan":"今週の学習プラン（日本語3文）"}
weaknessesは2〜4件。`));
      setRep({ st: "ok", d });
    } catch { setRep({ st: "err" }); }
  }

  /* ミニ会話 */
  async function chatTurn(c: any, txt: string) {
    const turns = txt ? [...c.turns, { r: "me", t: txt }] : c.turns;
    setChat({ ...c, turns, loading: true, err: false });
    const me = turns.filter((x: any) => x.r === "me").length;
    const hist = turns.map((x: any) => (x.r === "ai" ? "相手: " + x.en : "学習者: " + x.t)).join("\n");
    try {
      const d = parseJ(await ai(`あなたはビジネス英会話の練習相手です。場面: ${c.sc}。あなたは相手（取引先や同僚）役で、学習者はビジネスパーソンです。
これまでの会話:
${hist || "（まだなし）"}
これが学習者の${me}回目の発言です。4回目の発言を受けたら会話を締めてください。
JSONのみで返答してください:
{"fb":"学習者の直前の発言への簡潔な添削（文法・丁寧さ・より良い言い方）を日本語で。発言がなければ空文字","en":"あなたの次の発話（英語1〜2文）","jp":"その和訳","done":false,"summary":"doneがtrueのときだけ、会話全体の総評（日本語3文）"}`));
      const t2 = turns.map((x: any, i: number) => (txt && i === turns.length - 1 ? { ...x, fb: d.fb } : x));
      t2.push({ r: "ai", en: d.en, jp: d.jp });
      setChat({ ...c, turns: t2, loading: false, done: !!d.done || me >= 4, summary: d.summary || "" });
      setChatIn("");
    } catch { setChat({ ...c, turns: c.turns, loading: false, err: true }); }
  }

  /* メール添削 */
  async function mailGo() {
    if (!mailIn.trim()) return;
    setMailRes({ st: "load" });
    try {
      const d = parseJ(await ai(`あなたは日本人向けのビジネス英語の添削者です。次の英文メールを添削してください。
目的・相手: ${mailPu || "指定なし"}
メール:
${mailIn}
JSONのみで返答してください:
{"overall":"総評（日本語2〜3文）","scores":{"grammar":"◎か○か△か×","tone":"同上","structure":"同上","clarity":"同上"},"issues":[{"orig":"元の表現","fix":"直した表現","why":"理由（日本語）"}],"revised":"全体を直したメール全文（英語）","tips":"今後に活かせる助言（日本語）"}
issuesは重要なものを最大6件。`));
      setMailRes({ st: "ok", d });
    } catch { setMailRes({ st: "err" }); }
  }

  /* ───────── 画面 ───────── */
  /* 別画面 */
  if (view !== "quiz") {
    const T: Record<string, string> = { menu: "メニュー", stats: "📊 学習記録", scene: "🎬 場面を指定", fav: "⭐ お気に入り", chat: "💬 ミニ会話", mail: "✉️ メール添削", set: "⚙️ 設定" };
    const mx = Math.max(5, ...days.map((d) => d.n));
    const tn = Object.values(p.log).reduce((a, l) => a + l.n, 0), td = p.log[day()]?.n || 0;
    const wk = days.reduce((a, d) => a + d.n, 0), wo = days.reduce((a, d) => a + d.ok, 0);
    const favs = Object.values(p.fav);
    const menu: [View, string, string, string][] = [
      ["stats", "📊", "学習記録・弱点レポート", "連続日数、週間グラフ、AIによる弱点分析"],
      ["scene", "🎬", "場面を指定して出題", "「明日の商談」など自分の状況で問題を作る"],
      ["fav", "⭐", "お気に入り", "★を付けたフレーズの一覧"],
      ["chat", "💬", "ミニ会話", "取引先との会話を英語で数往復"],
      ["mail", "✉️", "メール添削", "書いた英文メールをAIが添削"],
      ["set", "⚙️", "設定", "レベル調整・音声の種類・速度"],
    ];
    return (
      <div className="h-dvh bg-slate-50 text-slate-900 flex flex-col max-w-md mx-auto font-sans">
        <Header>
          <div className="flex items-center justify-between">
            <button onClick={() => go(view === "menu" ? "quiz" : "menu")} className="flex items-center gap-1 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg px-3 py-1.5">
              <ArrowLeft className="w-4 h-4" />{view === "menu" ? "閉じる" : "戻る"}
            </button>
            <h1 className="font-bold text-base">{T[view]}</h1>
            <span className="w-[76px]" />
          </div>
        </Header>
        <main className="flex-1 overflow-y-auto p-4 space-y-3">
          {view === "menu" && menu.map(([v, ic, t1, t2]) => (
            <button key={v} onClick={() => go(v)} className={`${CARD} w-full flex items-center gap-3 text-left active:bg-slate-50`}>
              <span className="text-2xl">{ic}</span>
              <span><b className="block text-sm">{t1}</b><small className="text-slate-500">{t2}</small></span>
            </button>
          ))}

          {view === "stats" && (
            <>
              <div className={`${CARD} text-[15px]`}>🔥 連続 <b className="text-indigo-600">{streak}日</b>　今日 <b className="text-indigo-600">{td}問</b>　累計 <b className="text-indigo-600">{tn}問</b></div>
              <div className={CARD}>
                <span className="block text-xs font-bold text-slate-500">直近7日間の問題数（緑＝言えた）</span>
                <div className="flex gap-2 h-28 my-2">
                  {days.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="flex-1 w-full flex items-end">
                        <div className="w-full bg-indigo-100 rounded-t-md flex items-end min-h-0.5" style={{ height: `${(d.n / mx) * 100}%` }}>
                          <div className="w-full bg-emerald-500 rounded-t-md" style={{ height: `${d.n ? (d.ok / d.n) * 100 : 0}%` }} />
                        </div>
                      </div>
                      <small className="text-[11px] text-slate-500">{d.n}</small>
                      <small className="text-[11px] text-slate-500">{d.w}</small>
                    </div>
                  ))}
                </div>
                <p className="text-sm">今週の正答率 {wk ? Math.round((100 * wo) / wk) + "%" : "―"}　Lv.{p.lvl.toFixed(1)}　復習待ち {Object.keys(p.deck).length + Object.keys(p.later).length}問</p>
              </div>
              <button onClick={weakReport} className={PRI}>🧠 弱点レポートを作る</button>
              {rep && (
                <AiBox title="🧠 弱点レポート" x={rep} retry={weakReport} render={(d) => (
                  <>
                    <p>{d.summary}</p>
                    {Array.isArray(d.strengths) && d.strengths.length > 0 && <Sec t="👍 得意なこと">{d.strengths.map((s: string, i: number) => <p key={i}>・{s}</p>)}</Sec>}
                    {Array.isArray(d.weaknesses) && d.weaknesses.length > 0 && (
                      <Sec t="🎯 伸ばしたいこと">
                        {d.weaknesses.map((w: any, i: number) => <p key={i} className="mb-1"><b className="text-indigo-600">{w.area}</b>：{w.detail}<br /><span className="text-slate-500">練習: {w.drill}</span></p>)}
                      </Sec>
                    )}
                    {d.plan && <Sec t="📅 今週のプラン"><p>{d.plan}</p></Sec>}
                  </>
                )} />
              )}
            </>
          )}

          {view === "scene" && (
            <>
              <div className={`${CARD} text-sm`}>練習したい場面や状況を入力すると、「🎯 あなた専用」と「♾️ AI無限出題」がその場面の問題になります。</div>
              <input className={INP} value={sceneIn} onChange={(e) => setSceneIn(e.target.value)} placeholder="例: 明日の新規取引先との商談" />
              <div className="grid grid-cols-2 gap-3">
                <button className={PRI} onClick={() => { setP((s) => ({ ...s, scene: sceneIn.trim().slice(0, 80) })); setGen([]); setAdp([]); pickCat(ADP); setView("quiz"); }}>この場面で出題</button>
                <button className={SEC} onClick={() => { setP((s) => ({ ...s, scene: "" })); setSceneIn(""); setGen([]); setAdp([]); }}>解除</button>
              </div>
              <p className="text-xs text-slate-500">現在の場面: {p.scene || "指定なし（ランダム）"}</p>
            </>
          )}

          {view === "fav" && (favs.length === 0
            ? <div className={`${CARD} text-sm`}>お気に入りはまだありません。問題カードの左上の ☆ をタップすると、ここに保存されます。</div>
            : (
              <>
                {favs.map((f) => (
                  <div key={f[0]} className={`${CARD} text-sm select-text`}>
                    <span className="block text-xs text-slate-500">{f[0]}</span>
                    <EN t={f[1]} say={speak} />
                    <p className="text-slate-500 text-xs mt-1">{f[2]}</p>
                    <button className="mt-2 px-3 py-1 rounded-lg bg-slate-100 text-xs font-bold" onClick={() => setP((s) => { const fav = { ...s.fav }; delete fav[f[0]]; return { ...s, fav }; })}>★ 解除</button>
                  </div>
                ))}
                <button className={PRI} onClick={() => setP((s) => {
                  const deck = { ...s.deck };
                  Object.values(s.fav).forEach((f) => { if (!deck[f[0]] && !s.later[f[0]]) deck[f[0]] = { q: f, miss: 1, step: 0 }; });
                  return { ...s, deck };
                })}>すべて復習リストに追加</button>
              </>
            ))}

          {view === "chat" && (!chat ? (
            <>
              <div className={`${CARD} text-sm`}>取引先や同僚役のAIと、英語で数往復の会話を練習します。毎回、直前の発言を添削します。</div>
              <input className={INP} value={chatSc} onChange={(e) => setChatSc(e.target.value)} placeholder="場面（例: 納期の相談）" />
              <button className={PRI} onClick={() => chatTurn({ sc: chatSc.trim() || p.scene || "取引先との商談", turns: [] }, "")}>会話を始める</button>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500">場面: {chat.sc}</p>
              {chat.turns.map((x: any, i: number) => x.r === "ai" ? (
                <div key={i} className={`${CARD} max-w-[88%] self-start text-[15px] select-text`}><EN t={x.en} say={speak} /><span className="text-slate-500 text-sm">{x.jp}</span></div>
              ) : (
                <div key={i} className="max-w-[88%] ml-auto bg-indigo-600 text-white rounded-2xl p-3 text-[15px] select-text">
                  {x.t}{x.fb && <div className="mt-1.5 pt-1.5 border-t border-white/30 text-[13px]">{x.fb}</div>}
                </div>
              ))}
              {chat.loading && <p className="text-sm text-slate-500 animate-pulse">相手が考えています…</p>}
              {chat.done ? (
                <>
                  <div className={`${CARD} text-sm select-text`}><span className="block text-xs font-bold text-slate-500">総評</span>{chat.summary}</div>
                  <button className={PRI} onClick={() => { setChat(null); setChatIn(""); }}>新しい会話</button>
                </>
              ) : !chat.loading && (
                <>
                  {chat.err && <p className="text-sm text-slate-500">うまくいきませんでした。もう一度送信してください。</p>}
                  <input className={INP} lang="en" value={chatIn} onChange={(e) => setChatIn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && chatIn.trim()) chatTurn(chat, chatIn.trim()); }} placeholder="英語で返事（キーボードの🎤も使えます）" enterKeyHint="send" />
                  <button className={PRI} disabled={!chatIn.trim()} onClick={() => chatTurn(chat, chatIn.trim())}>送信</button>
                </>
              )}
            </>
          ))}

          {view === "mail" && (
            <>
              <div className={`${CARD} text-sm`}>自分で書いた英文メールを貼り付けると、AIが文法・トーン・構成・わかりやすさを添削します。</div>
              <textarea className={INP} rows={9} lang="en" value={mailIn} onChange={(e) => setMailIn(e.target.value)} placeholder="Dear Mr. Smith, ..." />
              <input className={INP} value={mailPu} onChange={(e) => setMailPu(e.target.value)} placeholder="目的・相手（例: 取引先への納期延長のお願い）" />
              <button className={PRI} onClick={mailGo} disabled={!mailIn.trim()}>添削する</button>
              {mailRes && (
                <AiBox title="✉️ 添削結果" x={mailRes} retry={mailGo} render={(d) => (
                  <>
                    <p>{d.overall}</p>
                    <Sec t="評価">
                      <p>文法 <b>{d.scores?.grammar}</b>　トーン <b>{d.scores?.tone}</b>　構成 <b>{d.scores?.structure}</b>　明確さ <b>{d.scores?.clarity}</b></p>
                    </Sec>
                    {Array.isArray(d.issues) && d.issues.length > 0 && (
                      <Sec t="🔧 直す点">
                        {d.issues.map((x: any, i: number) => <p key={i} className="mb-1"><span className="text-slate-500">{x.orig}</span><br />→ <b className="text-indigo-600">{x.fix}</b><br /><span className="text-slate-500">{x.why}</span></p>)}
                      </Sec>
                    )}
                    {d.revised && (
                      <Sec t="✅ 直したメール">
                        <pre className="whitespace-pre-wrap bg-slate-50 rounded-xl p-3 text-sm leading-relaxed font-sans">{d.revised}</pre>
                        <button className="mt-2 px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold" onClick={() => { try { navigator.clipboard.writeText(d.revised); setCopied(true); } catch {} }}>{copied ? "コピーしました" : "コピー"}</button>
                      </Sec>
                    )}
                    {d.tips && <Sec t="💡 アドバイス"><p>{d.tips}</p></Sec>}
                  </>
                )} />
              )}
            </>
          )}

          {view === "set" && (
            <>
              <div className={CARD}>
                <span className="block text-xs font-bold text-slate-500">レベル（出題の難しさ）</span>
                <p className="text-sm">Lv.<b className="text-indigo-600">{p.lvl.toFixed(1)}</b></p>
                <input type="range" min={1} max={5} step={0.1} value={p.lvl} onChange={(e) => setP((s) => ({ ...s, lvl: +e.target.value }))} className="w-full" />
                <p className="text-xs text-slate-500">1=中学基礎　3=中級　5=上級</p>
                <label className="text-sm flex items-center gap-2 mt-2">
                  <input type="checkbox" checked={!p.noauto} onChange={(e) => setP((s) => ({ ...s, noauto: !e.target.checked }))} />回答に合わせて自動調整する
                </label>
              </div>
              <div className={CARD}>
                <span className="block text-xs font-bold text-slate-500 mb-2">英語の声</span>
                <div className="grid grid-cols-2 gap-3">
                  {([["en-US", "🇺🇸 米国"], ["en-GB", "🇬🇧 英国"]] as const).map(([v, l]) => (
                    <button key={v} className={p.voice === v ? PRI : SEC} onClick={() => setP((s) => ({ ...s, voice: v }))}>{l}</button>
                  ))}
                </div>
              </div>
              <div className={CARD}>
                <span className="block text-xs font-bold text-slate-500 mb-2">読み上げ速度</span>
                <div className="grid grid-cols-4 gap-2">
                  {RATES.map((r) => <button key={r} className={`${p.rate === r ? PRI : SEC} !py-2.5 !text-sm`} onClick={() => setP((s) => ({ ...s, rate: r }))}>{r}x</button>)}
                </div>
              </div>
              <button className={SEC} onClick={() => speak("Thank you for your time. I will get back to you tomorrow.")}><Volume2 className="w-5 h-5" />声を試す</button>
            </>
          )}
        </main>
      </div>
    );
  }

  /* クイズ画面 */
  const loadingList = (cat === ADP && gl.adp) || (cat === GEN && gl.gen);
  const failedList = (cat === ADP && ge.adp) || (cat === GEN && ge.gen);
  const exData = q ? ex[q[0]] : null;
  const modes: [Mode, string, string][] = [["think", "💭", "通常"], ["speak", "🎤", "音声添削"], ["read", "🔇", "回答のみ"], ["shadow", "🗣", "真似読み"]];
  const mc = qs.filter((x) => p.mastered[x[0]]).length;
  const infinite = cat === ADP || cat === GEN;
  const showInput = (mode === "speak" && !shown) || (mode === "shadow" && !res);

  return (
    <div className="h-dvh bg-slate-50 text-slate-900 flex flex-col max-w-md mx-auto select-none font-sans">
      <Header>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h1 className="font-bold text-base tracking-tight text-slate-800">AI瞬間英作文トレーナー</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">
              {cat === ADP ? `Lv.${p.lvl.toFixed(1)}　` : ""}習得: {mc} / {infinite ? "∞" : qs.length}
            </span>
            <button onClick={() => go("menu")} aria-label="メニュー" className="p-1.5 rounded-lg bg-slate-100"><Menu className="w-4 h-4" /></button>
          </div>
        </div>
        <div ref={tabsRef} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {tabs.map((c) => (
            <button key={c} data-on={c === cat ? "1" : undefined} onClick={() => pickCat(c)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${c === cat ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 active:bg-slate-200"}`}>
              {c}{c === REV ? ` (${Object.keys(p.deck).length})` : ""}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-2.5">
          {modes.map(([m, ic, l]) => (
            <button key={m} onClick={() => changeMode(m)}
              className={`py-2 rounded-xl border text-[11px] font-bold ${mode === m ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-500"}`}>{ic} {l}</button>
          ))}
        </div>
      </Header>

      <main className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {!q ? (
          <div className={`${CARD} text-center min-h-[160px] flex flex-col items-center justify-center gap-3 my-auto`}>
            <span className="text-xs font-bold text-indigo-500">{cat === REV ? "🔁 復習" : cat === ADP ? "🎯 あなた専用" : "♾️ AI無限出題"}</span>
            <p className="text-base leading-relaxed">
              {cat === REV
                ? <>今日復習する問題はありません。<br />「もう一度」「あとでまた」にした問題や、音声添削で80点未満だった問題が、1日後・3日後・7日後に再び出ます。{Object.keys(p.later).length > 0 && <><br />復習待ち: {Object.keys(p.later).length}問</>}</>
                : loadingList ? <span className="animate-pulse">問題を作成中…</span>
                
              : failedList ? `エラー: ${failedList}` : "AIが新しい問題を作ります。"}

            </p>
            {cat !== REV && !loadingList && failedList && (
              <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold" onClick={() => { setGe({ gen: "", adp: "" }); }}>もう一度試す</button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-slate-200">
              <span className="text-sm font-bold text-slate-500">Q.{idx + 1} <span className="text-xs font-normal">/ {infinite ? "∞" : qs.length}</span></span>
              <div className="flex items-center gap-3">
                <button onClick={() => setP((s) => ({ ...s, rate: RATES[(RATES.indexOf(s.rate) + 1) % RATES.length] }))} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">速度: {p.rate}x</button>
                {hasTimer && (
                  <button onClick={() => setRunning((r) => !r)} className="flex items-center gap-1.5 font-bold text-indigo-600">
                    {running && !show ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span className={`tabular-nums text-base ${t <= 3 && !show ? "text-rose-600 animate-pulse" : ""}`}>{Math.max(t, 0)}秒</span>
                  </button>
                )}
              </div>
            </div>

            {cat === ADP && (
              <div className={`${CARD} !p-3 text-sm`}>
                🎯 <b className="text-indigo-600">Lv.{p.lvl.toFixed(1)}</b>（直近{Math.min(10, p.hist.length)}問の正答率 {p.hist.length ? Math.round((100 * p.hist.slice(-10).filter((h) => h.ok).length) / Math.min(10, p.hist.length)) + "%" : "データなし"}）
                {p.weak.length > 0 && <><br /><span className="text-slate-500">重点: {p.weak[p.weak.length - 1]}</span></>}
              </div>
            )}

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm min-h-[160px] flex flex-col justify-center items-center text-center relative">
              <button onClick={toggleFav} aria-label="お気に入り" className="absolute top-2 left-2 p-2 text-indigo-600">
                <Star className={`w-6 h-6 ${p.fav[q[0]] ? "fill-indigo-600" : ""}`} />
              </button>
              {p.mastered[q[0]] && (
                <span className="absolute top-3 right-3 text-emerald-600 flex items-center gap-1 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3.5 h-3.5" /> 習得済</span>
              )}
              <span className="text-xs font-bold text-indigo-500 mb-2 tracking-wider">
                {mode === "read" ? "英文を見て覚えよう" : mode === "shadow" ? "聞いて、真似して話そう" : "声に出して英訳しよう"}
              </span>
              <p className="text-xl font-bold leading-relaxed text-slate-800">{q[0]}</p>
            </div>

            {res && (
              <div className={`${CARD} text-base leading-8 select-text`}>
                <span className="block text-xs font-bold text-slate-500">あなたの回答</span>
                {res.H.map((w: any, i: number) => <span key={i} className={w.ok ? "text-emerald-600" : "text-rose-600 line-through"}>{w.d} </span>)}
                <span className="block text-xs font-bold text-slate-500 mt-2">正解（抜けた語は赤）</span>
                {res.A.map((w: any, i: number) => <span key={i} className={w.ok ? "text-emerald-600" : "text-rose-600 font-extrabold"}>{w.d} </span>)}
                <div className="mt-2 text-sm font-extrabold">{res.score}点　{res.score >= 90 ? "完璧です！" : res.score >= 70 ? "あと少し！赤い部分を直しましょう。" : "正解と見比べて、もう一度挑戦しましょう。"}</div>
              </div>
            )}
            {res && mode !== "shadow" && rv && <AiBox title="🤖 AI添削（複数の観点）" x={rv} retry={() => runReview(q, lastText)} render={(d) => <ReviewBody d={d} say={speak} />} />}

            {shown ? (
              <div className="bg-indigo-50/80 rounded-3xl p-5 border border-indigo-100 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xl font-extrabold text-indigo-950 leading-snug select-text">{q[1]}</p>
                  <button onClick={() => speak(q[1])} aria-label="英語を読み上げる" className="p-3 bg-indigo-600 text-white rounded-2xl shadow-sm active:scale-95 transition-transform shrink-0"><Volume2 className="w-6 h-6" /></button>
                </div>
                <div className="bg-white/90 rounded-2xl p-3.5 text-xs text-slate-700 leading-relaxed border border-indigo-100/60 select-text">
                  <span className="font-bold text-indigo-700 block mb-1">💡 ワンポイント解説</span>{q[2]}
                </div>
                {exData ? (
                  <AiBox title="🔍 詳しい解説" x={{ st: "ok", d: exData }} retry={explain} render={(d) => <ExplainBody d={d} say={speak} />} />
                ) : exS ? (
                  <AiBox title="🔍 詳しい解説" x={exS} retry={explain} render={() => null} />
                ) : (
                  <button onClick={explain} className="px-3 py-1.5 rounded-lg bg-white text-xs font-bold text-slate-700 border border-slate-200">🔍 AIで詳しく解説</button>
                )}
              </div>
            ) : (
              <div className="h-[140px] rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center text-center px-6 text-slate-400 text-sm font-medium">
                {mode === "speak" ? "英語でマイクに向かって話してください" : "頭の中で英文を組み立てたら下のボタンをタップ"}
              </div>
            )}

            {err && <div className={`${CARD} !p-3 text-sm text-slate-600`}>{err}</div>}
            {showInput && (
              <div className={`${CARD} space-y-2`}>
                <input className={INP} lang="en" value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) check(typed.trim()); }} placeholder="入力して回答（キーボードの🎤でも話せます）" autoCapitalize="off" autoCorrect="off" enterKeyHint="done" />
                <button className={`${PRI} !py-3`} disabled={!typed.trim()} onClick={() => check(typed.trim())}>添削する</button>
              </div>
            )}
          </>
        )}
      </main>

      {q && (
        <footer className="bg-white border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {listening ? (
            <button className={`${BTN} bg-rose-600 text-white shadow-md`} onClick={() => { try { recRef.current?.stop(); } catch {} }}><Square className="w-5 h-5" />聞き取り中…タップで終了</button>
          ) : mode === "shadow" ? (
            res ? (
              <div className="grid grid-cols-2 gap-3">
                <button className={SEC} onClick={() => { setRes(null); setRv(null); startRec(); }}><Mic className="w-5 h-5" />もう一度</button>
                <button className={OKB} onClick={() => next(res.score >= 80)}><CheckCircle2 className="w-5 h-5" />次へ<ChevronRight className="w-5 h-5" /></button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button className={SEC} onClick={() => speak(q[1])}><Volume2 className="w-5 h-5" />聞く</button>
                <button className={PRI} onClick={startRec}><Mic className="w-5 h-5" />真似して話す</button>
              </div>
            )
          ) : shown ? (
            mode === "speak" ? (
              <div className="grid grid-cols-2 gap-3">
                <button className={SEC} onClick={() => { setShow(false); setRes(null); setRv(null); setT(20); setRunning(true); startRec(); }}><Mic className="w-5 h-5" />もう一度話す</button>
                <button className={OKB} onClick={() => next(!!res && res.score >= 80)}><CheckCircle2 className="w-5 h-5" />次へ<ChevronRight className="w-5 h-5" /></button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button className={SEC} onClick={() => next(false)}><RotateCcw className="w-5 h-5" />{mode === "read" ? "あとでまた" : "もう一度"}</button>
                <button className={OKB} onClick={() => next(true)}><CheckCircle2 className="w-5 h-5" />{mode === "read" ? "覚えた！次へ" : "言えた！次へ"}<ChevronRight className="w-5 h-5" /></button>
              </div>
            )
          ) : mode === "speak" ? (
            <div className="grid grid-cols-2 gap-3">
              <button className={SEC} onClick={reveal}><HelpCircle className="w-5 h-5" />答えを見る</button>
              <button className={PRI} onClick={startRec}><Mic className="w-5 h-5" />話す</button>
            </div>
          ) : (
            <button className={PRI} onClick={reveal}><HelpCircle className="w-6 h-6" />答えを見る（音声再生）</button>
          )}
        </footer>
      )}
    </div>
  );
}

