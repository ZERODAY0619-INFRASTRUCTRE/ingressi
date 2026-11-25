import { APP_NAME, APP_FULL_NAME } from "@/src/lib/branding";

export function SystemHeader({ login = false, section = "Overview", sectionNumber = "01" }: { login?: boolean; section?: string; sectionNumber?: string }) {
  if (login) return <header className="eva-entry" aria-label={APP_NAME}>
    <div className="eva-entry-register"><span>TRAFFIC CONTROL SYSTEM</span><span>ENTRY / 00</span></div>
    <p className="eva-entry-title">{APP_NAME}</p>
    <p className="eva-entry-subtitle">IDENTITY <br />VERIFICATION</p>
    <div className="eva-entry-rule" aria-hidden="true" />
    <p className="eva-entry-description">{APP_FULL_NAME}</p>
    <p className="eva-entry-notice"><span aria-hidden="true">[ ! ]</span> AUTHENTICATION REQUIRED</p>
  </header>;
  return <header className="eva-workspace-header" aria-label={`Section ${sectionNumber}: ${section}`}>
    <div className="eva-route-marker"><span>SECTION</span><strong className="eva-section-id">{sectionNumber}</strong></div>
    <p className="eva-route-name">{section}</p>
    <span className="eva-header-caption">{APP_NAME} / MANAGEMENT INTERFACE</span>
  </header>;
}
