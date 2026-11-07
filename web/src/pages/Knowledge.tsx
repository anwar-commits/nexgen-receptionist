import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button, Card, Empty, ErrorBox, Field, Input, PageTitle, Spinner, Textarea } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatPhone, formatWhen } from "../lib/format";
import type { KnowledgeDoc, UnansweredQuestion } from "../lib/types";

type Draft = { id?: string; title: string; description: string; content: string };
const EMPTY: Draft = { title: "", description: "", content: "" };

export function Knowledge() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [draft, setDraft] = useState<Draft | null>(null);

  const docs = useQuery({ queryKey: ["knowledge"], queryFn: () => api<{ docs: KnowledgeDoc[] }>("/knowledge") });
  const questions = useQuery({ queryKey: ["unanswered"], queryFn: () => api<{ questions: UnansweredQuestion[] }>("/knowledge/unanswered") });

  const save = useMutation({
    mutationFn: (d: Draft) =>
      api<{ sync?: { synced: boolean; error?: string } }>(d.id ? `/knowledge/${d.id}` : "/knowledge", {
        method: d.id ? "PUT" : "POST",
        json: { title: d.title, description: d.description || null, content: d.content },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge"] });
      setDraft(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/knowledge/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge"] }),
  });
  const resolve = useMutation({
    mutationFn: (id: string) => api(`/knowledge/unanswered/${id}`, { method: "PATCH", json: { resolved: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["unanswered"] }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (draft) save.mutate(draft);
  }

  const lastSync = save.data?.sync;

  return (
    <>
      <PageTitle
        title="Knowledge base"
        subtitle="The agent only answers from what is here. For anything else it offers a consultation or a callback."
        actions={
          isAdmin && (
            <Button variant="primary" onClick={() => setDraft(EMPTY)}>
              Add document
            </Button>
          )
        }
      />
      <ErrorBox error={docs.error ?? save.error ?? remove.error} />
      {lastSync && !lastSync.synced && (
        <div role="status" className="rounded-[10px] bg-amber-50 px-4 py-3 text-amber-950">
          Saved here, but not sent to the agent yet: {lastSync.error}
        </div>
      )}

      {questions.data && questions.data.questions.length > 0 && (
        <Card className="flex flex-col gap-3 border-orange-200 bg-orange-50 p-5">
          <h2 className="text-[17px] font-bold text-orange-950">Questions the agent couldn't answer</h2>
          <ul className="flex flex-col gap-2">
            {questions.data.questions.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-white px-4 py-3">
                <span>
                  "{q.question}"<span className="block text-[13px] text-slate-600">{[formatPhone(q.callerPhone), formatWhen(q.createdAt)].join(" · ")}</span>
                </span>
                <Button size="sm" onClick={() => resolve.mutate(q.id)}>
                  Mark answered
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {draft && (
        <Card className="p-5">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <h2 className="text-[17px] font-bold">{draft.id ? "Edit document" : "New document"}</h2>
            <Field label="Title">{(id) => <Input id={id} required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />}</Field>
            <Field label="Short description">{(id) => <Input id={id} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />}</Field>
            <Field label="Content" hint="Write it the way the receptionist should explain it. Replace any [BRACKETS] with real clinic details.">
              {(id) => <Textarea id={id} required rows={12} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />}
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save and send to agent"}
              </Button>
              <Button onClick={() => setDraft(null)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        {docs.isLoading ? (
          <Spinner />
        ) : !docs.data?.docs.length ? (
          <Empty>No documents yet.</Empty>
        ) : (
          <ul>
            {docs.data.docs.map((d) => {
              const placeholders = (d.content.match(/\[[A-Z][^\]]*\]/g) ?? []).length;
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3.5 first:border-t-0">
                  <span className="min-w-60 flex-1">
                    <b>{d.title}</b>
                    <span className="block text-[13px] text-slate-600">
                      {d.description ?? "—"}
                      {placeholders > 0 && <span className="font-semibold text-amber-800"> · {placeholders} details to fill in</span>}
                      {!d.elevenlabsDocId && <span className="text-amber-800"> · not on the agent yet</span>}
                    </span>
                  </span>
                  {isAdmin && (
                    <span className="flex gap-2">
                      <Button size="sm" onClick={() => setDraft({ id: d.id, title: d.title, description: d.description ?? "", content: d.content })}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete "${d.title}"? The agent will stop using it.`)) remove.mutate(d.id);
                        }}
                      >
                        Delete
                      </Button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
