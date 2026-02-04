import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ArenaProvider } from "@/context/ArenaContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "智力競技場 | Arena of Intelligence",
  description: "盲測 AI 模型，找出您心目中的最強選手",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} antialiased min-h-screen bg-[var(--background)]`}>
        <ArenaProvider>
          {children}
        </ArenaProvider>
      </body>
    </html>
  );
}
