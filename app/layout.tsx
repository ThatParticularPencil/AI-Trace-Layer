import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Trace Layer",
  description: "Runtime governance and observability for LLM applications"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
