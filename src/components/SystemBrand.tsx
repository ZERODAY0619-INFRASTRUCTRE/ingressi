import { APP_NAME, APP_FULL_NAME } from "@/src/lib/branding";

export function SystemBrand() {
  return <div className="eva-brand" title={APP_FULL_NAME}><span className="eva-brand-register">[ TRAFFIC OPERATIONS ]</span><span className="eva-wordmark">{APP_NAME}</span><span className="eva-brand-caption">ORCHESTRATE / OBSERVE / ROUTE</span></div>;
}
