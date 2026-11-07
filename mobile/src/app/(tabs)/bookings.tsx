import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, SectionList, Text, View } from "react-native";
import { Badge, colors, Empty, ErrorText, Loading, styles } from "../../components/ui";
import { api } from "../../lib/api";
import { APPT_STATUS, formatDay, formatPhone, formatTime } from "../../lib/format";
import type { Appointment } from "../../lib/types";

export default function Bookings() {
  const query = useQuery({
    queryKey: ["appointments", "list"],
    queryFn: () => api<{ appointments: Appointment[] }>("/appointments?days=30"),
  });

  const sections: { title: string; data: Appointment[] }[] = [];
  for (const a of query.data?.appointments ?? []) {
    const day = formatDay(a.startsAt);
    const last = sections[sections.length - 1];
    if (last?.title === day) last.data.push(a);
    else sections.push({ title: day, data: [a] });
  }

  if (query.isLoading) return <Loading />;
  return (
    <View style={styles.screen}>
      <ErrorText error={query.error} />
      <SectionList
        sections={sections}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 16 }}
        stickySectionHeadersEnabled
        onRefresh={() => query.refetch()}
        refreshing={query.isRefetching}
        ListEmptyComponent={<Empty>No consultations booked for the next 30 days.</Empty>}
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={{ fontWeight: "700", color: colors.ink, paddingVertical: 8, backgroundColor: colors.ground }}>
            {section.title}
          </Text>
        )}
        renderItem={({ item: a }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/lead/${a.leadId}`)}
            style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8, gap: 4 }}
          >
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Text style={{ fontWeight: "700", color: colors.brand }}>{formatTime(a.startsAt)}</Text>
              <Badge tone={APPT_STATUS[a.status]} />
            </View>
            <Text style={{ fontWeight: "600", color: colors.ink }}>{a.lead?.name ?? formatPhone(a.lead?.phone ?? null)}</Text>
            <Text style={styles.muted}>
              {a.purpose ?? "Consultation"} · {a.bookedBy === "agent" ? "Booked by Riya" : "Booked by staff"}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
