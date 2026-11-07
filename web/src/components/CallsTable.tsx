import { Link } from "react-router-dom";
import { callerLabel, formatDuration, formatWhen, intentLabel, OUTCOME } from "../lib/format";
import type { Call } from "../lib/types";
import { Badge, Empty } from "./ui";

export function CallsTable({ calls, showDate = false }: { calls: Call[]; showDate?: boolean }) {
  if (!calls.length) return <Empty>No calls yet.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-600">
            <th className="px-5 py-2.5 font-semibold">Time</th>
            <th className="px-3 py-2.5 font-semibold">Caller</th>
            <th className="px-3 py-2.5 font-semibold">Language</th>
            <th className="px-3 py-2.5 font-semibold">Need</th>
            <th className="px-3 py-2.5 font-semibold">Outcome</th>
            <th className="px-3 py-2.5 font-semibold">Length</th>
            <th className="px-5 py-2.5">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => (
            <tr key={c.id} className="border-t border-slate-200">
              <td className="px-5 py-3 whitespace-nowrap">{showDate ? formatWhen(c.startedAt) : formatWhen(c.startedAt).replace("Today, ", "")}</td>
              <td className="px-3 py-3">{callerLabel(c)}</td>
              <td className="px-3 py-3">{c.language ?? "—"}</td>
              <td className="px-3 py-3">{intentLabel(c.intent)}</td>
              <td className="px-3 py-3">
                {c.outcome ? <Badge className={OUTCOME[c.outcome].className}>{OUTCOME[c.outcome].label}</Badge> : "—"}
              </td>
              <td className="px-3 py-3 whitespace-nowrap">{formatDuration(c.durationSecs)}</td>
              <td className="px-5 py-3">
                <Link to={`/calls/${c.id}`} className="font-semibold text-teal-700 hover:text-teal-800">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
