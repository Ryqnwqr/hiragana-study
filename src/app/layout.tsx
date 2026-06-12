import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { SafeAreaScript } from "@/components/SafeAreaScript";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["200", "300", "400", "700"],
  variable: "--font-noto-sans-jp",
});

export const metadata: Metadata = {
  title: "ひらがな",
  description:
    "Hiragana flashcard app with spaced repetition and reaction-time scoring",
  applicationName: "ひらがな",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    title: "ひらがな",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0c0e14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${notoSansJp.variable}`}>
      <head>
        <SafeAreaScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
