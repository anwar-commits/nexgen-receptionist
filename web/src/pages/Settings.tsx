import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Card, Check, ErrorBox, Field, Input, PageTitle, Select, Spinner, Textarea } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatWhen } from "../lib/format";
import type { Settings as S, SyncStatus } from "../lib/types";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </Card>
  );
}

export function Settings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const readOnly = user?.role !== "admin";
  const { data, error, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ settings: S; sync: SyncStatus }>("/settings"),
  });
  const [s, setS] = useState<S | null>(null);
  useEffect(() => {
    if (data) setS(data.settings);
  }, [data]);

  const save = useMutation({
    mutationFn: (next: S) => api<{ sync: { synced: boolean; error?: string } }>("/settings", { method: "PUT", json: next }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  if (isLoading || !s) return error ? <ErrorBox error={error} /> : <Spinner />;
  const sync = data!.sync;
  const set = <K extends keyof S>(k: K, v: S[K]) => setS({ ...s, [k]: v });
  const dirty = JSON.stringify(s) !== JSON.stringify(data!.settings);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
      <PageTitle
        title="Agent settings"
        subtitle={readOnly ? "Only admins can change these." : "Saving updates the live agent straight away."}
        actions={
          !readOnly && (
            <Button variant="primary" disabled={!dirty || save.isPending} onClick={() => save.mutate(s)}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          )
        }
      />
      <ErrorBox error={save.error} />
      {save.data && (
        <div role="status" className={save.data.sync.synced ? "rounded-[10px] bg-green-50 px-4 py-3 text-green-900" : "rounded-[10px] bg-amber-50 px-4 py-3 text-amber-950"}>
          {save.data.sync.synced ? "Saved. The agent is using the new settings." : `Saved here, but the agent wasn't updated: ${save.data.sync.error}`}
        </div>
      )}
      {(!sync.configured || !sync.toolsRegistered || sync.lastSyncError) && (
        <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
          <b>Agent connection: </b>
          {!sync.configured
            ? "add ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID to the server."
            : !sync.toolsRegistered
              ? "run `npm run elevenlabs:setup` on the server so the agent can book and save leads."
              : `last update failed: ${sync.lastSyncError}`}
          {sync.lastSyncedAt && <span className="block text-[13px]">Last successful update: {formatWhen(sync.lastSyncedAt)}</span>}
        </div>
      )}

      <fieldset disabled={readOnly} className="flex flex-col gap-6">
        <Section title="Voice and identity">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Agent name">{(id) => <Input id={id} value={s.agentName} onChange={(e) => set("agentName", e.target.value)} />}</Field>
            <Field label="Voice ID" hint="From the ElevenLabs voice library. Pick a Hindi + English voice.">
              {(id) => <Input id={id} value={s.voiceId} onChange={(e) => set("voiceId", e.target.value)} />}
            </Field>
          </div>
          <div>
            <p className="mb-1 font-semibold">Languages</p>
            <div className="flex flex-wrap gap-x-6">
              <Check label="Hindi" checked={s.languages.hindi} onChange={(v) => set("languages", { ...s.languages, hindi: v })} />
              <Check label="English" checked={s.languages.english} onChange={(v) => set("languages", { ...s.languages, english: v })} />
              <Check label="Switch automatically when the caller mixes (Hinglish)" checked={s.languages.autoSwitch} onChange={(v) => set("languages", { ...s.languages, autoSwitch: v })} />
            </div>
          </div>
          <Field label="First message">{(id) => <Textarea id={id} rows={2} value={s.firstMessage} onChange={(e) => set("firstMessage", e.target.value)} />}</Field>
        </Section>

        <Section title="Clinic hours">
          <div className="flex flex-wrap gap-4">
            <Field label="Days">
              {(id) => (
                <Select id={id} value={s.hours.days} onChange={(e) => set("hours", { ...s.hours, days: e.target.value as S["hours"]["days"] })}>
                  <option value="mon_sat">Monday to Saturday</option>
                  <option value="every_day">Every day</option>
                </Select>
              )}
            </Field>
            <Field label="Opens">{(id) => <Input id={id} type="time" value={s.hours.open} onChange={(e) => set("hours", { ...s.hours, open: e.target.value })} />}</Field>
            <Field label="Closes">{(id) => <Input id={id} type="time" value={s.hours.close} onChange={(e) => set("hours", { ...s.hours, close: e.target.value })} />}</Field>
          </div>
          <div>
            <p className="mb-1 font-semibold">After hours, the agent should</p>
            <Check type="radio" name="after" label="Answer questions and book consultations as usual" checked={s.afterHours === "answer"} onChange={() => set("afterHours", "answer")} />
            <Check type="radio" name="after" label="Take a message and schedule a callback" checked={s.afterHours === "message"} onChange={() => set("afterHours", "message")} />
          </div>
        </Section>

        <Section title="Booking">
          <div className="flex flex-wrap gap-4">
            <Field label="Doctor">{(id) => <Input id={id} value={s.booking.doctorName} onChange={(e) => set("booking", { ...s.booking, doctorName: e.target.value })} />}</Field>
            <Field label="Slot length">
              {(id) => (
                <Select
                  id={id}
                  value={s.booking.slotMinutes}
                  onChange={(e) => set("booking", { ...s.booking, slotMinutes: Number(e.target.value) as 30 | 45 | 60 })}
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </Select>
              )}
            </Field>
          </div>
          <Check
            label="Send a WhatsApp reminder the evening before"
            checked={s.booking.reminderEveningBefore}
            onChange={(v) => set("booking", { ...s.booking, reminderEveningBefore: v })}
          />
        </Section>

        <Section title="Hand-off to staff">
          <Field label="Front desk number" hint="With country code, e.g. +9198XXXXXXXX. Leave empty to use callbacks only.">
            {(id) => (
              <Input id={id} type="tel" className="max-w-sm" value={s.transfer.frontDeskNumber} onChange={(e) => set("transfer", { ...s.transfer, frontDeskNumber: e.target.value })} />
            )}
          </Field>
          <div>
            <p className="mb-1 font-semibold">Transfer the call when</p>
            <Check label="The caller asks for a person" checked={s.transfer.onRequest} onChange={(v) => set("transfer", { ...s.transfer, onRequest: v })} />
            <Check label="The caller has a complaint or a post-surgery problem" checked={s.transfer.onComplaint} onChange={(v) => set("transfer", { ...s.transfer, onComplaint: v })} />
            <Check label="The agent can't answer twice in a row" checked={s.transfer.onUnsure} onChange={(v) => set("transfer", { ...s.transfer, onUnsure: v })} />
          </div>
          <p className="text-slate-600">If nobody picks up, the agent takes a message and books a callback.</p>
        </Section>

        <Section title="Where leads go">
          <Check label="Clinic OS lead record" checked={s.delivery.clinicOs} onChange={(v) => set("delivery", { ...s.delivery, clinicOs: v })} />
          <Check label="WhatsApp alert to counsellor (and confirmations to patients)" checked={s.delivery.whatsapp} onChange={(v) => set("delivery", { ...s.delivery, whatsapp: v })} />
          <Check label="Google Sheet" checked={s.delivery.sheet} onChange={(v) => set("delivery", { ...s.delivery, sheet: v })} />
        </Section>

        <Section title="Guardrails">
          <p className="text-slate-600">Rules the agent always follows.</p>
          <Check label="Never diagnose or give medical advice; suggest a consultation" checked={s.guardrails.noDiagnosis} onChange={(v) => set("guardrails", { ...s.guardrails, noDiagnosis: v })} />
          <Check label="Give price ranges only, never a final quote" checked={s.guardrails.rangeOnly} onChange={(v) => set("guardrails", { ...s.guardrails, rangeOnly: v })} />
          <Check label="Never promise or guarantee results" checked={s.guardrails.noGuarantee} onChange={(v) => set("guardrails", { ...s.guardrails, noGuarantee: v })} />
          <Check label="Tell callers the call is recorded for quality" checked={s.guardrails.recordingNotice} onChange={(v) => set("guardrails", { ...s.guardrails, recordingNotice: v })} />
        </Section>
      </fieldset>
    </div>
  );
}
