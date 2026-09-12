import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sabrina Training Contract & Certificate of Ownership",
  description:
    "Consensual adult 24-hour hardcore feminization / sissification training contract between Marcus and Sabrina.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
