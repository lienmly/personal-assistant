import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ServiceWorkerRegistrar } from "@/components/shell/service-worker";
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
  applicationName: "Clan Centurio",
  // Installed on an iPhone home screen this opens without Safari's chrome, and
  // the label under the icon is the short name rather than the page title.
  // `statusBarStyle: "default"` keeps the web view *below* the status bar, which
  // is what lets the fixed topbar stay where it is — "black-translucent" would
  // slide it under the clock and need a top safe-area inset to undo.
  appleWebApp: {
    capable: true,
    title: "Centurio",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Nothing here is a phone number, and iOS turning task titles into blue call
  // links is a real thing it does to strings like "2026 08 09".
  formatDetection: { telephone: false },
  other: {
    // `appleWebApp.capable` emits the standardised `mobile-web-app-capable`,
    // which Safari only started honouring in iOS 17. On anything older the
    // installed icon opens in Safari *with the address bar* — which is the
    // exact complaint this whole change exists to fix, so the deprecated
    // spelling is worth the one line.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets `env(safe-area-inset-*)` report real values, which is what keeps the
  // mobile tab bar clear of the iPhone's home indicator once the app is
  // installed and there is no browser chrome down there any more.
  viewportFit: "cover",
  // The light theme's shell colour, so the status bar in a standalone window
  // matches the topbar underneath it. `ThemeProvider` rewrites this at sunset —
  // deliberately not the pre-paint boot script, because this tag is emitted by
  // Next's metadata and may not exist yet when that script runs. A status-bar
  // tint that corrects itself a frame later is invisible next to the page flash
  // the boot script is actually there to prevent.
  themeColor: "#f1efec",
  // Zoom is left alone on purpose: the journal has photographs in it.
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
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
