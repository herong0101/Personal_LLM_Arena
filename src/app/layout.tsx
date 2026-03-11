import type { Metadata } from 'next';
import { ArenaProvider } from '@/context/ArenaContext';
import './globals.css';

export const metadata: Metadata = {
  title: '語言模型體驗平台 | Arena of Intelligence',
  description: '整合模型競技場、長對話、使用者端記憶與多模型協作的語言模型體驗平台。',
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
