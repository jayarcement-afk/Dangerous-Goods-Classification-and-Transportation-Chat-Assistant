import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dangerous Goods Classification and Transportation Assistant",
  description:
    "Source-backed dangerous goods Q&A using the UN Orange Book.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
