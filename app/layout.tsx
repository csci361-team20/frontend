import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { LanguageProvider } from "@/components/language";
import { serverLang } from "@/lib/i18n-server";
import { translators } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Characterful display serif — the "human handwriting" of the brand.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = translators[await serverLang()];
  return {
    title: t("BiletFlow — tickets for the nights worth remembering"),
    description: t("Cinema, concerts, theatre and everything worth leaving the house for. Real seats, on your phone, in under a minute. Almaty & Astana."),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await serverLang();
  const t = translators[lang];
  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-cream">
        <LanguageProvider initial={lang}>
          <a className="skip-link" href="#main-content">
            {t("Skip to content")}
          </a>
          <SiteHeader />
          <div id="main-content" className="app-content">
            {children}
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
