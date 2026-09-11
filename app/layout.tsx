import type { ReactNode } from "react";
import { APP_NAME, APP_FULL_NAME } from "@/src/lib/branding";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: APP_NAME, description: APP_FULL_NAME };

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
import { headers } from "next/headers";
import "./globals.css";
import Providers from "./providers";

function getNonce(csp: string | null): string | undefined {
  if (!csp) return undefined;
  const m = csp.match(/'nonce-([A-Za-z0-9+/=]+)'/);
  return m?.[1];
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const h = await headers();
  const nonce = getNonce(h.get("Content-Security-Policy"));

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
