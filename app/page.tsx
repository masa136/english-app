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
