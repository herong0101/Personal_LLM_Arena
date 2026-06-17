import type { Metadata, Viewport } from 'next';
import { ArenaProvider } from '@/context/ArenaContext';
import AppShell from '@/components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: '語言模型體驗平台 | Arena of Intelligence',
  description: '整合模型競技場、長對話、使用者端記憶與多模型協作的語言模型體驗平台。',
};

export const viewport: Viewport = {
  themeColor: '#f7f7f4',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="antialiased h-screen overflow-hidden bg-[var(--background)]">
        <ArenaProvider>
          <AppShell>{children}</AppShell>
        </ArenaProvider>
      </body>
    </html>
  );
}
