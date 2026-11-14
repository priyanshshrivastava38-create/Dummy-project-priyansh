import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "OpsLedger — Procurement decision intelligence",
    template: "%s · OpsLedger",
  },
  description:
    "OpsLedger turns purchase requests, vendor quotations and approvals into transparent, auditable procurement decisions.",
  applicationName: "OpsLedger",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
