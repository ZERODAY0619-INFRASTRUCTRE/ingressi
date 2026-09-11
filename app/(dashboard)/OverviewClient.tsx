"use client";

import Link from "next/link";
import { ArrowUpRight, Activity } from "lucide-react";
import { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/button";

type StatCard = { label: string; icon: ReactNode; count: number; href: string };
type RecentEvent = { summary: string; createdAt: string };
type TrafficSummary = { totalRequests: number; blockedPercent: number; analyticsDisabled?: boolean; loggingDisabled?: boolean } | null;

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "JUST NOW";
  if (minutes < 60) return `${minutes}M AGO`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}H AGO`;
  return new Date(value).toLocaleDateString("en-US");
}

export default function OverviewClient({ userName, stats, trafficSummary, recentEvents, isAdmin = true }: {
  userName: string; stats: StatCard[]; trafficSummary: TrafficSummary; recentEvents: RecentEvent[]; isAdmin?: boolean;
}) {
  const available = !!trafficSummary && !trafficSummary.analyticsDisabled && !trafficSummary.loggingDisabled;
  const total = available ? trafficSummary.totalRequests : null;
  const blocked = available && total! > 0 && Number.isFinite(trafficSummary.blockedPercent)
    ? Math.max(0, Math.min(100, trafficSummary.blockedPercent)) : null;
  const unavailable = trafficSummary?.analyticsDisabled || trafficSummary?.loggingDisabled ? "COLLECTION DISABLED" : "DATA UNAVAILABLE";
  return <div className="eva-overview">
    <div className="eva-page-intro"><div><p className="eva-kicker">CENTRAL OPERATIONS</p><h1>COMMAND OVERVIEW</h1><p className="eva-operator">Operator / {userName}</p></div>
      {isAdmin && <Button asChild variant="outline"><Link href="/analytics">Open analytics <ArrowUpRight /></Link></Button>}
    </div>
    {isAdmin ? <>
      <div className="eva-command-board">
        <section className="eva-traffic-instrument eva-panel" aria-label="Traffic in the last 24 hours">
          <div className="eva-panel-label"><span>01 / TRAFFIC MONITOR</span><span>WINDOW / 24H</span></div>
          <div className="eva-instrument-body">
            <div className="eva-request-readout"><span className="eva-instrument-tag">TRAFFIC / INGRESS</span><p className="eva-kicker">REQUEST VOLUME</p><p className="eva-hero-number" title={total === null ? unavailable : total.toLocaleString("en-US")}>{total === null ? "—" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(total)}</p><p className="eva-readout-state">{total === null ? unavailable : total === 0 ? "NO REQUESTS RECORDED" : "REQUESTS RECORDED"}</p></div>
            <div className="eva-radial" aria-label={blocked === null ? "Blocked ratio unavailable" : `${blocked.toFixed(1)} percent blocked`}>
              <svg viewBox="0 0 220 220" aria-hidden="true"><circle className="eva-dial-envelope" cx="110" cy="110" r="96" /><circle className="eva-dial-inner" cx="110" cy="110" r="65" /><circle className="eva-dial-outer" cx="110" cy="110" r="105" />{Array.from({ length: 60 }, (_, index) => <line key={index} className="eva-dial-tick" x1="110" y1="11" x2="110" y2={index % 5 === 0 ? "23" : "17"} transform={`rotate(${index * 6} 110 110)`} />)}<circle className="eva-dial-track" cx="110" cy="110" r="80" /><circle className="eva-dial-value" cx="110" cy="110" r="80" pathLength="100" strokeDasharray={`${blocked ?? 0} 100`} transform="rotate(-90 110 110)" /><path className="eva-dial-cross" d="M24 110h15m142 0h15M110 24v15m0 142v15" /><path className="eva-dial-bracket" d="M6 45V6h39m130 0h39v39M6 175v39h39m130 0h39v-39" /></svg>
              <div className="eva-radial-copy"><span>BLOCKED</span><strong>{blocked === null ? "—" : blocked.toFixed(1)}<small>{blocked === null ? "" : "%"}</small></strong><span>{blocked === null ? "NO RATIO DATA" : "OF REQUESTS"}</span></div>
            </div>
          </div>
          <div className="eva-ratio-array" aria-label={blocked === null ? "Blocked share has no sample" : `Blocked share: ${blocked.toFixed(1)} percent`}>
            <div className="eva-array-legend"><span>BLOCKED SHARE</span><span>{blocked === null ? "NO SAMPLE" : `${blocked.toFixed(1)} / 100%`}</span></div>
            <div className="eva-array-slots" aria-hidden="true">{Array.from({ length: 20 }, (_, index) => <i key={index} style={{ "--slot-fill": `${blocked === null ? 0 : Math.max(0, Math.min(100, (blocked - index * 5) * 20))}%` } as CSSProperties} />)}</div>
            <div className="eva-array-scale" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span></div>
          </div>
          <div className="eva-instrument-footer"><span>24H AGGREGATE</span><span>DETAIL / REQUEST ANALYTICS</span><Link href="/analytics" aria-label="View request analytics"><ArrowUpRight size={18} /></Link></div>
        </section>
        <section className="eva-resource-bank eva-panel" aria-label="Configured resources"><div className="eva-panel-label"><span>02 / RESOURCE REGISTRY</span><span>CONFIGURED</span></div>
          {stats.map((stat, index) => <Link className="eva-resource-row" key={stat.href} href={stat.href}><span className="eva-resource-index">{String(index + 1).padStart(2, "0")}</span><span className="eva-resource-detail"><span className="eva-resource-name">{stat.icon}{stat.label}</span><span className="eva-resource-slots" aria-hidden="true">{Array.from({ length: 12 }, (_, slot) => <i key={slot} data-filled={slot < stat.count} />)}</span></span><strong>{stat.count.toLocaleString("en-US")}</strong><ArrowUpRight size={16} /></Link>)}
          <p className="eva-bank-note">Each slot represents one resource.<br />Up to 12 shown; totals remain exact.</p>
        </section>
      </div>
      <section className="eva-event-log eva-panel" aria-labelledby="activity-title"><div className="eva-panel-label"><h2 id="activity-title"><Activity size={15} /> EVENT LOG</h2><Link href="/audit-log">VIEW AUDIT LOG <ArrowUpRight size={14} /></Link></div>
        {recentEvents.length === 0 ? <p className="eva-empty-state">NO EVENTS RECORDED</p> : <ol>{recentEvents.map((event, index) => <li key={`${event.createdAt}-${index}`}><span className="eva-event-index">{String(index + 1).padStart(2, "0")}</span><p>{event.summary}</p><time dateTime={event.createdAt} title={new Date(event.createdAt).toLocaleString("en-US")}>{relativeTime(event.createdAt)}</time></li>)}</ol>}
      </section>
    </> : <section className="eva-panel eva-user-entry"><p className="eva-kicker">ACCOUNT ACCESS</p><h2>YOUR SESSION IS READY</h2><p>Manage your profile and account settings.</p><Button asChild><Link href="/profile">Open profile <ArrowUpRight /></Link></Button></section>}
  </div>;
}
