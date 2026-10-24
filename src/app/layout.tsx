import type { Metadata, Viewport } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";

// next/font downloads the font files at build time and serves them from this
// server. Browsers never contact Google, which keeps the UI GDPR-clean
// (cf. LG München, 3 O 17493/20).
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const name = process.env.APP_NAME || "Chat Engine";
  return {
    title: { default: name, template: `%s · ${name}` },
    description: "Self-hosted AI assistant for your company's knowledge.",
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#050505",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${manrope.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
