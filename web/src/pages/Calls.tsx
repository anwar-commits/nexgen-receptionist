import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CallsTable } from "../components/CallsTable";
import { Button, Card, ErrorBox, Input, PageTitle, Select, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { OUTCOME } from "../lib/format";
import type { Call, Outcome } from "../lib/types";

const PAGE = 25;

export function Calls() {
  const [range, setRange] = useState("all");
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ range, page: String(page), pageSize: String(PAGE) });
  if (outcome) params.set("outcome", outcome);
  if (q.trim()) params.set("q", q.trim());

  const { data, error, isLoading } = useQuery({
    queryKey: ["calls", params.toString()],
    queryFn: () => api<{ calls: Call[]; total: number }>(`/calls?${params}`),
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <>
      <PageTitle title="Calls" subtitle={data ? `${data.total} calls` : undefined} />
      <div className="flex flex-wrap gap-3">
        <Input
          aria-label="Search by name, number or city"
          placeholder="Search name, number or city"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="min-w-64 flex-1"
        />
        <Select aria-label="Period" value={range} onChange={(e) => (setRange(e.target.value), setPage(1))}>
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </Select>
        <Select aria-label="Outcome" value={outcome} onChange={(e) => (setOutcome(e.target.value as Outcome | ""), setPage(1))}>
          <option value="">All outcomes</option>
          {Object.entries(OUTCOME).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
      </div>
      <ErrorBox error={error} />
      <Card className="overflow-hidden">{isLoading ? <Spinner /> : <CallsTable calls={data?.calls ?? []} showDate />}</Card>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-3">
          <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-slate-600">
            Page {page} of {pages}
          </span>
          <Button size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </>
  );
}
