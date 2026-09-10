import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Outreacher",
  description: "Find relevant professors and start meaningful conversations."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
