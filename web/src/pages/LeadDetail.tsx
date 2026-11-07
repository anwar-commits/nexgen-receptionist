import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookingForm } from "../components/BookingForm";
import { CallsTable } from "../components/CallsTable";
import { BackIcon } from "../components/icons";
import { Badge, Button, Card, ErrorBox, Field, Input, Select, Spinner, Textarea } from "../components/ui";
import { api } from "../lib/api";
import { APPT_STATUS, formatDateTime, formatPhone, LEAD_STATUS } from "../lib/format";
import type { Appointment, AppointmentStatus, Call, Lead, LeadStatus, User } from "../lib/types";

const FIELDS: { key: keyof Lead; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "city", label: "City" },
  { key: "concern", label: "Concern" },
  { key: "hairLossDuration", label: "For how long" },
  { key: "treatmentInterest", label: "Interested in" },
  { key: "hairLossStage", label: "Hair-loss stage" },
  { key: "budget", label: "Budget" },
  { key: "source", label: "Source" },
];

export function LeadDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => api<{ lead: Lead; calls: Call[]; appointments: Appointment[] }>(`/leads/${id}`),
  });
  const staff = useQuery({ queryKey: ["users"], queryFn: () => api<{ users: User[] }>("/users") });
  const [form, setForm] = useState<Partial<Lead>>({});
  useEffect(() => {
    if (data) setForm(data.lead);
  }, [data]);

  const save = useMutation({
    mutationFn: (patch: Partial<Lead>) => api(`/leads/${id}`, { method: "PATCH", json: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
  const setAppt = useMutation({
    mutationFn: ({ apptId, status }: { apptId: string; status: AppointmentStatus }) =>
      api(`/appointments/${apptId}`, { method: "PATCH", json: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead", id] }),
  });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error ?? new Error("Lead not found")} />;
  const { lead } = data;

  const details = Object.fromEntries(FIELDS.map((f) => [f.key, (form[f.key] as string | null) || null]));

  return (
    <>
      <Link to="/leads" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-teal-700 hover:text-teal-800">
        <BackIcon /> All leads
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] leading-9 font-bold">{lead.name ?? "Unknown name"}</h1>
          <p className="mt-1 text-slate-600">{formatPhone(lead.phone)}</p>
        </div>
        <a href={`tel:${lead.phone}`} className="inline-flex h-11 items-center rounded-[10px] border border-slate-300 bg-white px-4 font-semibold hover:bg-slate-50">
          Call
        </a>
      </div>
      <ErrorBox error={save.error ?? setAppt.error} />

      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex min-w-0 flex-[3_1_480px] flex-col gap-4 p-5">
          <h2 className="text-[17px] font-bold">Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                {(fid) => <Input id={fid} value={(form[f.key] as string | null) ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}
              </Field>
            ))}
          </div>
          <Field label="Notes">{(fid) => <Textarea id={fid} rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}</Field>
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={() => save.mutate({ ...details, notes: form.notes || null })} disabled={save.isPending}>
              Save
            </Button>
            {save.isSuccess && <span className="text-green-800">Saved</span>}
          </div>
        </Card>

        <div className="flex min-w-0 flex-[2_1_300px] flex-col gap-6">
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-bold">Status</h2>
              <Badge className={LEAD_STATUS[lead.status].className}>{LEAD_STATUS[lead.status].label}</Badge>
            </div>
            <Field label="Stage">
              {(fid) => (
                <Select id={fid} value={lead.status} onChange={(e) => save.mutate({ status: e.target.value as LeadStatus })}>
                  {Object.entries(LEAD_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Assigned counsellor">
              {(fid) => (
                <Select id={fid} value={lead.assignedToId ?? ""} onChange={(e) => save.mutate({ assignedToId: e.target.value || null })}>
                  <option value="">Not assigned</option>
                  {staff.data?.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-[17px] font-bold">Consultations</h2>
            {data.appointments.length === 0 && <p className="text-slate-600">None booked yet.</p>}
            {data.appointments.map((a) => (
              <div key={a.id} className="flex flex-col gap-2 rounded-[10px] bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b>{formatDateTime(a.startsAt)}</b>
                  <Badge className={APPT_STATUS[a.status].className}>{APPT_STATUS[a.status].label}</Badge>
                </div>
                <span className="text-sm text-slate-600">
                  {a.purpose ?? "Consultation"} · {a.doctorName} · booked by {a.bookedBy === "agent" ? "Riya" : "staff"}
                </span>
                {a.status === "scheduled" && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setAppt.mutate({ apptId: a.id, status: "completed" })}>
                      Visited
                    </Button>
                    <Button size="sm" onClick={() => setAppt.mutate({ apptId: a.id, status: "no_show" })}>
                      No-show
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAppt.mutate({ apptId: a.id, status: "cancelled" })}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </Card>
        </div>
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <h2 className="text-[17px] font-bold">Book a consultation</h2>
        <BookingForm phone={lead.phone} name={lead.name} />
      </Card>

      <Card className="overflow-hidden">
        <h2 className="px-5 py-4 text-[17px] font-bold">Calls from this number</h2>
        <CallsTable calls={data.calls} showDate />
      </Card>
    </>
  );
}
