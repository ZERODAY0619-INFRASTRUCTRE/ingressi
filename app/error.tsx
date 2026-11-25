"use client";
import { useEffect } from "react";
import { StatusPage } from "./StatusPage";
import { statusMessages } from "@/src/lib/status-pages";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Application error", error); }, [error]);
  return <StatusPage {...statusMessages.error} reset={reset} digest={error.digest} />;
}
