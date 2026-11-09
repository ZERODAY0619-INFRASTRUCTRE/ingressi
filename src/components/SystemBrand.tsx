import { APP_NAME, APP_FULL_NAME } from "@/src/lib/branding";

export function SystemBrand() {
  return <div className="flex items-center gap-3" title={APP_FULL_NAME}><span aria-hidden="true" className="grid size-9 place-items-center rounded-lg bg-brand-fill text-lg font-semibold text-on-brand-fill">T</span><div><span className="block text-lg font-semibold tracking-tight">{APP_NAME}</span><span className="block text-xs text-soft">Traffic management</span></div></div>;
}
