import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perya Color Game",
  description: "A streaming-ready visual recreation of the Filipino perya Color Game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
