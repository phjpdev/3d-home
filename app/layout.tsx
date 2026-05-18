import type { Metadata } from "next";
import { Crimson_Pro, Geist, Geist_Mono } from "next/font/google";
import SiteChrome from "@/components/SiteChrome";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const museumSerif = Crimson_Pro({
  variable: "--font-museum-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Einstein House · 3D",
  description:
    "A period-room digital house: compose objects, stroll the parquet, generate models.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${museumSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full min-h-[100dvh] flex-col">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
