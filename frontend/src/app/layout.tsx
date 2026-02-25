import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({ weight: ["400", "500", "700"], subsets: ["latin"] });

export const metadata = {
  title: "CapitalBase",
  description: "B2B Financial Data Terminal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${roboto.className} bg-slate-50 text-slate-900 antialiased`}>
        {/* Everything else is injected here based on the URL */}
        {children}
      </body>
    </html>
  );
}