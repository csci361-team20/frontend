import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { LocaleProvider, LocalizedSkipLink } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "BiletFlow — tickets for the nights worth remembering",
  description:
    "Discover public events in Kazakhstan and manage organizer profiles, events and ticket types with BiletFlow.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-cream">
        <LocaleProvider>
        <LocalizedSkipLink />
        <SiteHeader />
        <div id="main-content" className="app-content" tabIndex={-1}>
          {children}
        </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
