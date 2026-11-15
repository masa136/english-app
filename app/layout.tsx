
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI瞬間英作文',
  description: 'Gemini APIを使った瞬間英作文トレーナー',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
