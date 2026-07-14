import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sprachheld — German to C1",
  description: "Personal open-source German learning platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="topnav">
          <Link href="/" className="brand">Sprachheld</Link>
          <Link href="/vocab">Vocab</Link>
          <Link href="/grammar">Grammar</Link>
          <Link href="/listening">Listening</Link>
          <Link href="/speaking">Speaking</Link>
          <Link href="/writing">Writing</Link>
        </nav>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
