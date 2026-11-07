import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { SyncStatus } from "../lib/types";
import { LogoutIcon } from "./icons";
import { cx } from "./ui";

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/calls", label: "Calls" },
  { to: "/leads", label: "Leads" },
  { to: "/bookings", label: "Bookings" },
  { to: "/callbacks", label: "Callbacks" },
  { to: "/knowledge", label: "Knowledge base" },
  { to: "/settings", label: "Agent settings" },
];

function AgentStatus() {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ sync: SyncStatus }>("/settings"),
    staleTime: 60_000,
  });
  const ok = data?.sync.configured && data.sync.toolsRegistered && !data.sync.lastSyncError;
  if (!data) return null;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold",
        ok ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900",
      )}
    >
      <span className={cx("h-2 w-2 rounded-full", ok ? "bg-green-600" : "bg-amber-600")} aria-hidden="true" />
      {ok ? "Agent live · answering calls" : "Agent setup incomplete"}
    </span>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-teal-700 font-display text-lg font-bold text-white">N</div>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold">NexGen Hair Transplant</span>
            <span className="text-[13px] text-slate-600">Receptionist agent</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AgentStatus />
          <span className="hidden text-sm text-slate-600 sm:inline">{user?.name}</span>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-slate-800 hover:bg-slate-300"
          >
            <LogoutIcon />
          </button>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1440px] flex-wrap gap-6 px-4 py-6 sm:px-8">
        <nav aria-label="Main" className="flex w-full flex-row gap-1 overflow-x-auto md:w-auto md:max-w-60 md:flex-[1_1_200px] md:flex-col">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  "flex min-h-11 shrink-0 items-center rounded-[10px] px-3 whitespace-nowrap",
                  isActive ? "bg-teal-50 font-semibold text-teal-900" : "text-slate-700 hover:bg-slate-100",
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
