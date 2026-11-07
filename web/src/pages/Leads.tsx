import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Empty, ErrorBox, Input, PageTitle, Select, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { formatPhone, formatWhen, LEAD_STATUS } from "../lib/format";
import type { Lead, LeadStatus } from "../lib/types";

const PAGE = 25;

export function Leads() {
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
  if (status) params.set("status", status);
  if (q.trim()) params.set("q", q.trim());
  const { data, error, isLoading } = useQuery({
    queryKey: ["leads", params.toString()],
    queryFn: () => api<{ leads: Lead[]; total: number }>(`/leads?${params}`),
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <>
      <PageTitle title="Leads" subtitle={data ? `${data.total} people` : undefined} />
      <div className="flex flex-wrap gap-3">
        <Input
          aria-label="Search by name, number or city"
          placeholder="Search name, number or city"
          value={q}
          onChange={(e) => (setQ(e.target.value), setPage(1))}
          className="min-w-64 flex-1"
        />
        <Select aria-label="Status" value={status} onChange={(e) => (setStatus(e.target.value as LeadStatus | ""), setPage(1))}>
          <option value="">All statuses</option>
          {Object.entries(LEAD_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
      </div>
      <ErrorBox error={error} />
      <Card className="overflow-hidden">
        {isLoading ? (
          <Spinner />
        ) : !data?.leads.length ? (
          <Empty>No leads match.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="px-5 py-2.5 font-semibold">Name</th>
                  <th className="px-3 py-2.5 font-semibold">Phone</th>
                  <th className="px-3 py-2.5 font-semibold">City</th>
                  <th className="px-3 py-2.5 font-semibold">Interested in</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Last update</th>
                </tr>
              </thead>
              <tbody>
                {data.leads.map((l) => (
                  <tr key={l.id} className="border-t border-slate-200">
                    <td className="px-5 py-3">
                      <Link to={`/leads/${l.id}`} className="font-semibold text-teal-700 hover:text-teal-800">
                        {l.name ?? "Unknown name"}
                      </Link>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatPhone(l.phone)}</td>
                    <td className="px-3 py-3">{l.city ?? "—"}</td>
                    <td className="px-3 py-3">{l.treatmentInterest ?? l.concern ?? "—"}</td>
                    <td className="px-3 py-3">
                      <Badge className={LEAD_STATUS[l.status].className}>{LEAD_STATUS[l.status].label}</Badge>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatWhen(l.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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
