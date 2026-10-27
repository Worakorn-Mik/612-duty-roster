import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const font = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-noto-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "เวรประจำวัน ห้อง 612 (SK145)",
  description: "เช็คเวรประจำวัน คิวถัดไป และตารางเวรทั้งรอบ ของห้อง 612 (SK145)",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4338ca",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={font.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
