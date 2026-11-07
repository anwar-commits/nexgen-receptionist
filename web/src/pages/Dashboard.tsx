import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CallsTable } from "../components/CallsTable";
import { Card, cx, Empty, ErrorBox, PageTitle, Segmented, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { formatDay, formatDuration, formatTime, intentLabel } from "../lib/format";
import type { Appointment, Call, LiveCall, Range, Stats } from "../lib/types";

const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

function Kpi({ label, value, note, accent }: { label: string; value: string | number; note?: string; accent?: boolean }) {
  return (
    <div className={cx("flex-[1_1_170px] rounded-[14px] p-5", accent ? "bg-teal-700 text-white" : "border border-slate-200 bg-white")}>
      <div className={cx("text-[13px]", accent ? "text-teal-50" : "text-slate-600")}>{label}</div>
      <div className="mt-1.5 font-display text-[32px] leading-10 font-bold">{value}</div>
      {note && <div className={cx("text-[13px]", accent ? "text-teal-50" : "text-slate-600")}>{note}</div>}
    </div>
  );
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}% of calls` : "—");

function LiveCalls() {
  const { data } = useQuery({
    queryKey: ["live"],
    queryFn: () => api<{ live: LiveCall[]; configured: boolean }>("/calls/live"),
    refetchInterval: 8000,
  });
  if (!data?.live.length) return null;
  return (
    <>
      {data.live.map((l) => (
        <Card key={l.conversationId} aria-label="Live call" className="flex flex-col gap-3.5 border-orange-300 p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-orange-600" aria-hidden="true" />
            <span className="font-bold">On a call now</span>
            <span className="text-slate-600">
              {l.callerLabel} · started {formatTime(l.startedAt)}
            </span>
          </div>
          {l.recentTurns.length > 0 && (
            <div className="flex flex-col gap-2 rounded-[10px] bg-slate-50 p-3.5">
              {l.recentTurns.map((t, i) => (
                <p key={i}>
                  <b className={t.role === "agent" ? "text-teal-700" : "text-slate-600"}>{t.role === "agent" ? "Riya:" : "Caller:"}</b> {t.message}
                </p>
              ))}
            </div>
          )}
        </Card>
      ))}
    </>
  );
}

export function Dashboard() {
  const [range, setRange] = useState<Range>("today");
  const stats = useQuery({ queryKey: ["stats", range], queryFn: () => api<Stats>(`/stats?range=${range}`) });
  const calls = useQuery({ queryKey: ["calls", "recent"], queryFn: () => api<{ calls: Call[] }>("/calls?pageSize=8") });
  const upcoming = useQuery({ queryKey: ["appointments", "upcoming"], queryFn: () => api<{ appointments: Appointment[] }>("/appointments?days=7&status=scheduled") });

  const s = stats.data;
  const hindi = s?.languages.find((l) => l.language === "Hindi")?.count ?? 0;
  const maxIntent = Math.max(1, ...(s?.topIntents.map((i) => i.count) ?? [1]));
  const todayLabel = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }).format(new Date());

  return (
    <>
      <PageTitle
        title={range === "today" ? `Today, ${todayLabel}` : `Last ${range === "7d" ? "7" : "30"} days`}
        actions={<Segmented label="Date range" value={range} options={RANGES} onChange={setRange} />}
      />
      <ErrorBox error={stats.error} />
      {s ? (
        <div className="flex flex-wrap gap-4">
          <Kpi label="Calls answered" value={s.calls} note="Every call is picked up" />
          <Kpi label="Qualified leads" value={s.qualifiedLeads} note={pct(s.qualifiedLeads, s.calls)} />
          <Kpi label="Consultations booked" value={s.booked} note={pct(s.booked, s.calls)} accent />
          <Kpi label="Handed to staff" value={s.handedToStaff} note={`${s.pendingCallbacks} callbacks pending`} />
          <Kpi
            label="Avg. call length"
            value={formatDuration(s.avgDurationSecs)}
            note={s.calls ? `Hindi ${Math.round((hindi / s.calls) * 100)}% · other ${100 - Math.round((hindi / s.calls) * 100)}%` : undefined}
          />
        </div>
      ) : (
        <Spinner />
      )}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-6">
          <LiveCalls />
          <Card aria-labelledby="recent" className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 id="recent" className="text-[17px] font-bold">
                Recent calls
              </h2>
              <Link to="/calls" className="font-semibold text-teal-700 hover:text-teal-800">
                View all
              </Link>
            </div>
            {calls.data ? <CallsTable calls={calls.data.calls} /> : <Spinner />}
          </Card>
        </div>

        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-6">
          <Card aria-labelledby="upcoming" className="flex flex-col gap-3 p-5">
            <h2 id="upcoming" className="text-[17px] font-bold">
              Upcoming consultations
            </h2>
            {upcoming.data?.appointments.length === 0 && <p className="text-slate-600">Nothing booked for the next 7 days.</p>}
            {upcoming.data?.appointments.slice(0, 5).map((a) => (
              <Link key={a.id} to={`/leads/${a.leadId}`} className="flex gap-3 rounded-[10px] bg-slate-50 p-3 hover:bg-slate-100">
                <div className="min-w-[88px] font-bold whitespace-nowrap text-teal-700">
                  {formatDay(a.startsAt).split(",")[0].split(" ")[0]}
                  <br />
                  {formatTime(a.startsAt)}
                </div>
                <div>
                  <div className="font-semibold">{a.lead?.name ?? a.lead?.phone}</div>
                  <div className="text-[13px] text-slate-600">
                    {a.purpose ?? "Consultation"} · {a.doctorName}
                  </div>
                </div>
              </Link>
            ))}
          </Card>

          <Card aria-labelledby="needs" className="flex flex-col gap-3.5 p-5">
            <h2 id="needs" className="text-[17px] font-bold">
              Why people called
            </h2>
            {s && s.topIntents.length === 0 && <Empty>No calls in this period.</Empty>}
            {s?.topIntents.map((i) => (
              <div key={i.intent}>
                <div className="flex justify-between">
                  <span>{intentLabel(i.intent)}</span>
                  <b>{i.count}</b>
                </div>
                <div className="mt-1.5 h-1.5 rounded bg-slate-200">
                  <div className="h-1.5 rounded bg-teal-700" style={{ width: `${(i.count / maxIntent) * 100}%` }} />
                </div>
              </div>
            ))}
            {s && s.unansweredQuestions > 0 && (
              <Link to="/knowledge" className="rounded-[10px] bg-orange-50 p-3 text-[14px] text-orange-950 hover:bg-orange-100">
                <b>{s.unansweredQuestions} {s.unansweredQuestions === 1 ? "question" : "questions"}</b> the agent couldn't answer. Add answers to the knowledge base.
              </Link>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
