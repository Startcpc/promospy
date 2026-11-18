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
  title: "PromoSpy — промокоды на еду",
  icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
  description:
    "Промокоды магазинов и ресторанов с условиями, сроками и ссылками на открытые источники. Бесплатный поиск без регистрации.",
  keywords: [
    "промокоды",
    "рестораны",
    "доставка",
    "Россия",
  ],
  authors: [{ name: "PromoSpy" }],
  openGraph: {
    title: "Промокоды магазинов и ресторанов",
    description: "Промокоды магазинов и ресторанов с условиями, сроками и официальными источниками",
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
