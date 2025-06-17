// src/app/layout.tsx
import "./globals.css";
import Providers from "@/components/Providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        {/* 必要ならmetaタグなどもここに */}
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
