import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { BookingForm } from "../components/BookingForm";
import { Badge, Button, Card, Empty, ErrorBox, PageTitle, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { APPT_STATUS, formatDay, formatPhone, formatTime } from "../lib/format";
import type { Appointment } from "../lib/types";

export function Bookings() {
  const [showForm, setShowForm] = useState(false);
  const { data, error, isLoading } = useQuery({
    queryKey: ["appointments", "list"],
    queryFn: () => api<{ appointments: Appointment[] }>("/appointments?days=30"),
  });

  const byDay = new Map<string, Appointment[]>();
  for (const a of data?.appointments ?? []) {
    const d = formatDay(a.startsAt);
    byDay.set(d, [...(byDay.get(d) ?? []), a]);
  }

  return (
    <>
      <PageTitle
        title="Bookings"
        subtitle="Consultations for the next 30 days"
        actions={
          <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close" : "New booking"}
          </Button>
        }
      />
      {showForm && (
        <Card className="p-5">
          <BookingForm onDone={() => setShowForm(false)} />
        </Card>
      )}
      <ErrorBox error={error} />
      {isLoading && <Spinner />}
      {data && byDay.size === 0 && (
        <Card>
          <Empty>No consultations booked.</Empty>
        </Card>
      )}
      {[...byDay.entries()].map(([day, appts]) => (
        <Card key={day} className="overflow-hidden">
          <h2 className="border-b border-slate-200 bg-slate-50 px-5 py-3 font-bold">{day}</h2>
          <ul>
            {appts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-4 border-t border-slate-200 px-5 py-3 first:border-t-0">
                <span className="w-20 font-bold text-teal-700">{formatTime(a.startsAt)}</span>
                <Link to={`/leads/${a.leadId}`} className="min-w-40 flex-1 font-semibold hover:text-teal-800">
                  {a.lead?.name ?? formatPhone(a.lead?.phone ?? null)}
                  <span className="block text-[13px] font-normal text-slate-600">
                    {a.purpose ?? "Consultation"} · {a.doctorName}
                  </span>
                </Link>
                <span className="text-sm text-slate-600">{a.bookedBy === "agent" ? "Booked by Riya" : "Booked by staff"}</span>
                <Badge className={APPT_STATUS[a.status].className}>{APPT_STATUS[a.status].label}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </>
  );
}
