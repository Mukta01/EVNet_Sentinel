import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "EVNet Sentinel | EVCS Intrusion Detection System",
  description:
    "ML-powered intrusion detection for Electric Vehicle Charging Station networks. Real-time threat detection with ARF + ADWIN online learning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-[#020617] text-[#F8FAFC] antialiased noise-overlay`}
      >
        {children}
      </body>
    </html>
  );
}
