import { Manrope } from "next/font/google";

import { CompanyTabsProvider } from "@/components/app/company-tabs-provider";
import "./globals.css";

const manrope = Manrope({ weight: ["400", "500", "600", "700"], subsets: ["latin"] });

export const metadata = {
  title: "CapitalBase",
  description: "B2B Financial Data Terminal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.className} min-h-screen text-[var(--cb-text-strong)]`}>
        <CompanyTabsProvider>{children}</CompanyTabsProvider>
      </body>
    </html>
  );
}
