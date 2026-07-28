import type { Metadata } from "next";
import Nav from "@/components/Nav";
import SyncProvider from "@/components/SyncProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bei Opa — Learn German with heart",
  description: "Learn German to C1 with Opa: vocabulary, grammar, listening, speaking, writing — and a little German culture every day.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SyncProvider />
        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
