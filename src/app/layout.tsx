import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-sans",

});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-mono",

});

export const metadata: Metadata = {
  title: "PromoSpy — промокоды магазинов",
  icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
  description:
    "Промокоды магазинов с условиями, сроками и ссылками на источники. Бесплатный поиск без регистрации.",
  keywords: [
    "промокоды",
    "ВкусВилл",
    "Магнит",
    "METRO",
    "ЁДО Суши",
    "доставка",
    "Россия",
  ],
  authors: [{ name: "PromoSpy" }],
  openGraph: {
    title: "PromoSpy — промокоды магазинов",
    description: "Промокоды магазинов с условиями и ссылками на источники",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
