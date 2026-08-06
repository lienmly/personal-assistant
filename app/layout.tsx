import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/shell/theme-provider";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clan Centurio",
  description:
    "A private personal assistant dashboard, with Montblanc at its heart.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      // The boot script below writes `data-theme` and `color-scheme` onto this
      // element before React loads, so the DOM legitimately has two attributes
      // the server's markup does not. React diffs every attribute of an element
      // it renders and would report that as a hydration mismatch.
      //
      // This is the narrow case the escape hatch is for, and it is narrow:
      // `suppressHydrationWarning` applies one level deep, so it covers exactly
      // this element's own attributes and nothing inside the app. The
      // alternative — rendering the theme server-side — cannot work, because
      // the server does not know what time it is where you are, which is the
      // whole problem.
      suppressHydrationWarning
    >
      <head>
        {/* Runs before the first paint and before React, so a night-time load
            arrives dark instead of flashing white and correcting itself.
            See lib/theme.ts. */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
