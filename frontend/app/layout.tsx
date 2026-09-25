import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReachInbox Scheduler",
  description: "A tiny slice of what ReachInbox does under the hood.",
};

import { Toaster } from "react-hot-toast";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Toaster position="bottom-right" />
        {children}
      </body>
    </html>
  );
}
