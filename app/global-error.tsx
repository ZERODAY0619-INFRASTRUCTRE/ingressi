"use client";
import { StatusPage } from "./StatusPage";
import { statusMessages } from "@/src/lib/status-pages";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body style={{ margin: 0 }}><StatusPage {...statusMessages.error} reset={reset} digest={error.digest} /></body></html>;
}
