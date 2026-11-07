import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { CallRow } from "../../components/CallRow";
import { Card, colors, Empty, ErrorText, Loading, SectionTitle, styles } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { formatDay, formatDuration, formatTime } from "../../lib/format";
import type { Appointment, Call, LiveCall, Range, Stats } from "../../lib/types";

const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

function Kpi({ label, value, note, accent }: { label: string; value: string | number; note?: string; accent?: boolean }) {
  return (
    <View
      style={{
        flexBasis: "47%",
        flexGrow: 1,
        borderRadius: 14,
        padding: 14,
        backgroundColor: accent ? colors.brand : colors.card,
        borderWidth: accent ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 13, color: accent ? "#CCFBF1" : colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 28, fontWeight: "700", marginTop: 4, color: accent ? "#fff" : colors.ink }}>{value}</Text>
      {note && <Text style={{ fontSize: 12, color: accent ? "#CCFBF1" : colors.muted }}>{note}</Text>}
    </View>
  );
}

export default function Overview() {
  const { user, logout } = useAuth();
  const [range, setRange] = useState<Range>("today");
  const stats = useQuery({ queryKey: ["stats", range], queryFn: () => api<Stats>(`/stats?range=${range}`) });
  const calls = useQuery({ queryKey: ["calls", "recent"], queryFn: () => api<{ calls: Call[] }>("/calls?pageSize=5") });
  const live = useQuery({ queryKey: ["live"], queryFn: () => api<{ live: LiveCall[] }>("/calls/live"), refetchInterval: 8000 });
  const upcoming = useQuery({
    queryKey: ["appointments", "upcoming"],
    queryFn: () => api<{ appointments: Appointment[] }>("/appointments?days=7&status=scheduled"),
  });
  const s = stats.data;
  const refreshing = stats.isRefetching || calls.isRefetching;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            stats.refetch();
            calls.refetch();
            upcoming.refetch();
            live.refetch();
          }}
        />
      }
    >
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Text style={{ fontSize: 15, color: colors.muted }}>Hi {user?.name}</Text>
        <Pressable accessibilityRole="button" onPress={logout} hitSlop={12} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ color: colors.brand, fontWeight: "600" }}>Sign out</Text>
        </Pressable>
      </View>

      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", backgroundColor: "#E2E8F0", borderRadius: 12, padding: 4, gap: 4 }}>
        {RANGES.map((r) => (
          <Pressable
            key={r.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: range === r.value }}
            onPress={() => setRange(r.value)}
            style={{ flex: 1, minHeight: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: range === r.value ? "#fff" : "transparent" }}
          >
            <Text style={{ fontWeight: range === r.value ? "700" : "400", color: colors.ink }}>{r.label}</Text>
          </Pressable>
        ))}
      </View>

      <ErrorText error={stats.error} />
      {s ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Kpi label="Calls answered" value={s.calls} />
          <Kpi label="Qualified leads" value={s.qualifiedLeads} />
          <Kpi label="Consultations booked" value={s.booked} accent />
          <Kpi label="Handed to staff" value={s.handedToStaff} note={`${s.pendingCallbacks} callbacks pending`} />
          <Kpi label="Avg. call length" value={formatDuration(s.avgDurationSecs)} />
        </View>
      ) : (
        <Loading />
      )}

      {live.data?.live.map((l) => (
        <Card key={l.conversationId} style={{ borderColor: "#FDBA74", gap: 8 }}>
          <Text style={{ fontWeight: "700", color: colors.ink }}>On a call now · {l.callerLabel}</Text>
          {l.recentTurns.map((t, i) => (
            <Text key={i} style={styles.body}>
              <Text style={{ fontWeight: "700", color: t.role === "agent" ? colors.brand : colors.muted }}>{t.role === "agent" ? "Riya: " : "Caller: "}</Text>
              {t.message}
            </Text>
          ))}
        </Card>
      ))}

      <Card>
        <SectionTitle>Upcoming consultations</SectionTitle>
        {upcoming.data?.appointments.length === 0 && <Empty>Nothing booked for the next 7 days.</Empty>}
        {upcoming.data?.appointments.slice(0, 4).map((a) => (
          <Pressable
            key={a.id}
            accessibilityRole="button"
            onPress={() => router.push(`/lead/${a.leadId}`)}
            style={{ flexDirection: "row", gap: 12, paddingVertical: 10 }}
          >
            <Text style={{ width: 88, fontWeight: "700", color: colors.brand }}>
              {formatDay(a.startsAt).split(" ")[0]} {formatTime(a.startsAt)}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600", color: colors.ink }}>{a.lead?.name ?? a.lead?.phone}</Text>
              <Text style={styles.muted}>{a.purpose ?? "Consultation"}</Text>
            </View>
          </Pressable>
        ))}
      </Card>

      <Card>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <SectionTitle>Recent calls</SectionTitle>
          <Pressable accessibilityRole="link" onPress={() => router.push("/calls")} hitSlop={12}>
            <Text style={{ color: colors.brand, fontWeight: "600" }}>View all</Text>
          </Pressable>
        </View>
        {calls.data?.calls.length === 0 && <Empty>No calls yet.</Empty>}
        {calls.data?.calls.map((c, i) => (
          <View key={c.id}>
            {i > 0 && <View style={styles.divider} />}
            <CallRow call={c} />
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}
