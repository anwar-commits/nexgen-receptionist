import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, Empty, ErrorBox, PageTitle, Segmented, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { formatPhone, formatWhen } from "../lib/format";
import type { Callback } from "../lib/types";

export function Callbacks() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "done">("pending");
  const { data, error, isLoading } = useQuery({
    queryKey: ["callbacks", status],
    queryFn: () => api<{ callbacks: Callback[] }>(`/callbacks?status=${status}`),
  });
  const mark = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "pending" | "done" }) => api(`/callbacks/${id}`, { method: "PATCH", json: { status: next } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["callbacks"] }),
  });

  return (
    <>
      <PageTitle
        title="Callbacks"
        subtitle="Callers who asked for a person when nobody could pick up"
        actions={
          <Segmented
            label="Show"
            value={status}
            onChange={setStatus}
            options={[
              { value: "pending", label: "To call" },
              { value: "done", label: "Done" },
            ]}
          />
        }
      />
      <ErrorBox error={error ?? mark.error} />
      <Card className="overflow-hidden">
        {isLoading ? (
          <Spinner />
        ) : !data?.callbacks.length ? (
          <Empty>{status === "pending" ? "No one is waiting for a callback." : "Nothing here yet."}</Empty>
        ) : (
          <ul>
            {data.callbacks.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-4 border-t border-slate-200 px-5 py-4 first:border-t-0">
                <div className="min-w-48 flex-1">
                  <div className="font-semibold">{c.name ?? formatPhone(c.phone)}</div>
                  <div className="text-sm text-slate-600">
                    {c.reason ?? "No reason given"} · {formatWhen(c.createdAt)}
                  </div>
                </div>
                <a href={`tel:${c.phone}`} className="inline-flex h-9 items-center rounded-[10px] border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-50">
                  Call {formatPhone(c.phone)}
                </a>
                <Button size="sm" variant={status === "pending" ? "primary" : "secondary"} onClick={() => mark.mutate({ id: c.id, next: status === "pending" ? "done" : "pending" })}>
                  {status === "pending" ? "Mark done" : "Move back"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
