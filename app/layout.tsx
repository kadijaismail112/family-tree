import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ToastProvider } from "@/components/ui";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
});

const description =
  "Build your family tree together. Every branch remembers who added it, and the whole family keeps it honest.";

/**
 * `viewport-fit: "cover"` is what makes env(safe-area-inset-*) return real
 * numbers on a notched phone. Without it iOS reports zero for all of them, and
 * the three places that pad for the home indicator — including the view tabs
 * at the bottom of a family — were padding by nothing and sitting underneath
 * it, which is why those tabs were so hard to hit.
 *
 * maximumScale is deliberately left alone: capping zoom stops people enlarging
 * text they can't read, and this app is full of names and dates.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.trydynasty.app"),
  title: {
    default: "Dynasty — private, collaborative family trees",
    template: "%s · Dynasty",
  },
  description,
  applicationName: "Dynasty",
  openGraph: {
    type: "website",
    siteName: "Dynasty",
    url: "/",
    title: "Dynasty — private, collaborative family trees",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Dynasty — private, collaborative family trees",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="font-sans">
        <StoreProvider>
          <ToastProvider>{children}</ToastProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
