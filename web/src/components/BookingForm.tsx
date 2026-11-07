import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { todayIst } from "../lib/format";
import { Button, ErrorBox, Field, Input, Select } from "./ui";

const to12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

/** Staff booking: pick a date, see free slots, book. Phone/name are fixed when booking for a known lead. */
export function BookingForm({ phone: fixedPhone, name: fixedName, onDone }: { phone?: string; name?: string | null; onDone?: () => void }) {
  const qc = useQueryClient();
  const [phone, setPhone] = useState(fixedPhone ?? "");
  const [name, setName] = useState(fixedName ?? "");
  const [date, setDate] = useState(todayIst());
  const [time, setTime] = useState("");

  const slots = useQuery({
    queryKey: ["availability", date],
    queryFn: () => api<{ slots: string[] }>(`/appointments/availability?date=${date}`),
    enabled: Boolean(date),
  });

  const book = useMutation({
    mutationFn: () => api("/appointments", { method: "POST", json: { phone, name: name || undefined, date, time } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["lead"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
      setTime("");
      onDone?.();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    book.mutate();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <ErrorBox error={book.error} />
      {!fixedPhone && (
        <div className="flex flex-wrap gap-4">
          <div className="flex-[1_1_200px]">
            <Field label="Mobile number">{(id) => <Input id={id} type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full" />}</Field>
          </div>
          <div className="flex-[1_1_200px]">
            <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} className="w-full" />}</Field>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Date">
          {(id) => <Input id={id} type="date" min={todayIst()} required value={date} onChange={(e) => (setDate(e.target.value), setTime(""))} />}
        </Field>
        <Field label="Time">
          {(id) => (
            <Select id={id} required value={time} onChange={(e) => setTime(e.target.value)} className="min-w-40">
              <option value="">{slots.isLoading ? "Loading…" : slots.data?.slots.length ? "Pick a slot" : "No free slots"}</option>
              {slots.data?.slots.map((s) => (
                <option key={s} value={s}>
                  {to12(s)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit" variant="primary" disabled={!time || book.isPending}>
          {book.isPending ? "Booking…" : "Book consultation"}
        </Button>
      </div>
      {book.isSuccess && <p className="text-green-800">Booked. A WhatsApp confirmation goes to the patient if WhatsApp is set up.</p>}
    </form>
  );
}
