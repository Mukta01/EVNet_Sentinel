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
    "Leakage-corrected intrusion detection for EV charging station networks: an audit of ARF + ADWIN on CICEVSE2024, per-attack testing, and an interactive demo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint, so a light-theme visitor
            never sees a dark flash. ThemeToggle keeps it in sync afterwards. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("evnet-theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-[#020617] text-[#F8FAFC] antialiased noise-overlay`}
      >
        <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async />
        {children}
      </body>
    </html>
  );
}
