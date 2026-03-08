import type { Metadata } from 'next';
import { ArenaProvider } from '@/context/ArenaContext';
import './globals.css';

export const metadata: Metadata = {
  title: '智力競技場 | Arena of Intelligence',
  description: '以盲測或非盲測方式比較真實 AI 模型，並匯出對戰結果與回饋。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="antialiased min-h-screen bg-[var(--background)]">
        <ArenaProvider>
          {children}
        </ArenaProvider>
      </body>
    </html>
  );
}
