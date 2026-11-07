import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BackIcon, CheckIcon } from "../components/icons";
import { Badge, Button, Card, ErrorBox, Spinner, Textarea } from "../components/ui";
import { api, audioUrl } from "../lib/api";
import { formatDateTime, formatDuration, formatPhone, formatWhen, intentLabel, LEAD_STATUS, OUTCOME } from "../lib/format";
import type { Appointment, Call, Lead, TranscriptTurn } from "../lib/types";

interface CallResponse {
  call: Call;
  transcript: TranscriptTurn[];
  lead: Lead | null;
  appointments: Appointment[];
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-600">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value || "Not shared"}</dd>
    </div>
  );
}

export function CallDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({ queryKey: ["call", id], queryFn: () => api<CallResponse>(`/calls/${id}`) });
  const [notes, setNotes] = useState("");
  const [audioFailed, setAudioFailed] = useState(false);
  useEffect(() => setNotes(data?.call.staffNotes ?? ""), [data?.call.staffNotes]);

  const saveNotes = useMutation({
    mutationFn: () => api(`/calls/${id}`, { method: "PATCH", json: { staffNotes: notes || null } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call", id] }),
  });
  const convert = useMutation({
    mutationFn: () => api(`/leads/${data!.lead!.id}`, { method: "PATCH", json: { status: "converted" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call", id] }),
  });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error ?? new Error("Call not found")} />;
  const { call, transcript, lead, appointments } = data;
  const nextAppt = appointments.find((a) => a.status === "scheduled");

  return (
    <>
      <Link to="/calls" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-teal-700 hover:text-teal-800">
        <BackIcon /> All calls
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <h1 className="font-display text-[28px] leading-9 font-bold">
            {[call.callerName, formatPhone(call.callerPhone)].filter(Boolean).join(" · ")}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            {call.outcome && <Badge className={OUTCOME[call.outcome].className}>{OUTCOME[call.outcome].label}</Badge>}
            {call.language && <Badge className="bg-slate-100 text-slate-700">{call.language}</Badge>}
            <span>
              {formatWhen(call.startedAt)} · {formatDuration(call.durationSecs)} · {intentLabel(call.intent)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {call.callerPhone && (
            <a href={`tel:${call.callerPhone}`} className="inline-flex h-11 items-center rounded-[10px] border border-slate-300 bg-white px-4 font-semibold hover:bg-slate-50">
              Call back
            </a>
          )}
          {lead && (
            <Link to={`/leads/${lead.id}`} className="inline-flex h-11 items-center rounded-[10px] border border-slate-300 bg-white px-4 font-semibold hover:bg-slate-50">
              Assign counsellor
            </Link>
          )}
          {lead && lead.status !== "converted" && (
            <Button variant="primary" onClick={() => convert.mutate()} disabled={convert.isPending}>
              Mark as converted
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-6">
          <Card aria-label="Recording" className="p-4">
            {audioFailed ? (
              <p className="text-slate-600">The recording isn't available for this call.</p>
            ) : (
              <audio controls preload="none" src={audioUrl(call.id)} onError={() => setAudioFailed(true)} className="w-full">
                Your browser can't play this recording.
              </audio>
            )}
          </Card>
          <Card aria-labelledby="transcript" className="flex flex-col gap-3.5 p-5">
            <h2 id="transcript" className="text-[17px] font-bold">
              Transcript
            </h2>
            {transcript.length === 0 && <p className="text-slate-600">No transcript for this call.</p>}
            <div className="flex flex-col gap-3">
              {transcript.map((t) => (
                <div
                  key={t.id}
                  className={
                    t.role === "agent"
                      ? "max-w-[78%] self-start rounded-[4px_14px_14px_14px] bg-teal-50 px-3.5 py-3"
                      : "max-w-[78%] self-end rounded-[14px_4px_14px_14px] bg-slate-100 px-3.5 py-3"
                  }
                >
                  <div className={t.role === "agent" ? "mb-1 text-xs font-semibold text-teal-900" : "mb-1 text-xs font-semibold text-slate-600"}>
                    {t.role === "agent" ? "Riya" : "Caller"} · {mmss(t.timeSecs)}
                  </div>
                  {t.message}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-6">
          <Card aria-labelledby="summary" className="flex flex-col gap-2.5 p-5">
            <h2 id="summary" className="text-[17px] font-bold">
              AI summary
            </h2>
            <p className="text-slate-700">{call.summary ?? "No summary yet."}</p>
          </Card>

          <Card aria-labelledby="lead" className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 id="lead" className="text-[17px] font-bold">
                Lead captured
              </h2>
              {lead && (
                <div className="flex items-center gap-2">
                  <Badge className={LEAD_STATUS[lead.status].className}>{LEAD_STATUS[lead.status].label}</Badge>
                  <Link to={`/leads/${lead.id}`} className="font-semibold text-teal-700 hover:text-teal-800">
                    Edit
                  </Link>
                </div>
              )}
            </div>
            {lead ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Info label="Name" value={lead.name} />
                <Info label="City" value={lead.city} />
                <Info label="Concern" value={lead.concern} />
                <Info label="For how long" value={lead.hairLossDuration} />
                <Info label="Interested in" value={lead.treatmentInterest} />
                <Info label="Hair-loss stage" value={lead.hairLossStage ?? "To assess at visit"} />
                <Info label="Budget" value={lead.budget} />
                <Info label="Source" value={lead.source} />
              </dl>
            ) : (
              <p className="text-slate-600">No lead details were captured on this call.</p>
            )}
            {nextAppt && (
              <div className="rounded-[10px] bg-teal-50 p-3 text-teal-900">
                <b>Booked:</b> {formatDateTime(nextAppt.startsAt)} · {nextAppt.doctorName}
              </div>
            )}
          </Card>

          {lead && (
            <Card aria-labelledby="sent" className="flex flex-col gap-2.5 p-5">
              <h2 id="sent" className="text-[17px] font-bold">
                Follow-up
              </h2>
              <p className="flex items-center gap-2">
                <CheckIcon className="text-green-700" /> Saved as a lead{nextAppt ? " with a booking" : ""}
              </p>
              <p className="text-[13px] text-slate-600">WhatsApp and Clinic OS delivery follow the switches in Agent settings.</p>
            </Card>
          )}

          <Card className="flex flex-col gap-2.5 p-5">
            <label htmlFor="notes" className="text-[17px] font-bold">
              Staff notes
            </label>
            <Textarea id="notes" rows={3} placeholder="Add a note for the counsellor" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending || notes === (call.staffNotes ?? "")}>
                Save note
              </Button>
              {saveNotes.isSuccess && <span className="text-sm text-green-800">Saved</span>}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
