import { headers } from "next/headers";
import { StatusPage } from "./StatusPage";
import { requestDetails } from "@/src/lib/status-response";
export default async function Page(){const h=await headers();return <StatusPage code="404" details={requestDetails(h,h.get("host")||"",h.get("x-cpm-request-path")||"/")}/>;}
