import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import Nav from "@/components/Nav";
import SyncProvider from "@/components/SyncProvider";
import SpeechWarmup from "@/components/SpeechWarmup";
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
        <SpeechWarmup />
        <Nav />
        <main className="container">{children}</main>
        <footer className="site-footer">
          Sentences from{" "}
          <a href="https://tatoeba.org" target="_blank" rel="noreferrer">Tatoeba</a> (CC BY 2.0 FR) ·
          Photos via <a href="https://openverse.org" target="_blank" rel="noreferrer">Openverse</a> (CC0/PD) ·
          Made with ❤️ und Opa
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
