import type { Metadata } from "next";
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
    card: "summary",
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
