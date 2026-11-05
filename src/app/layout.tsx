import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

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
  description:
    "Промокоды российских магазинов и маркетплейсов с условиями, сроками и источниками: Магнит, Пятёрочка, Яндекс Маркет, Wildberries, Ozon и другие.",
  keywords: [
    "промокоды",
    "магазины",
    "маркетплейсы",
    "доставка",
    "Россия",
    "логотипы брендов",
  ],
  authors: [{ name: "PromoSpy" }],
  openGraph: {
    title: "Компании с промокодами",
    description: "Промокоды магазинов с условиями, сроками и официальными источниками",
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
        <Toaster />
      </body>
    </html>
  );
}
