import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Badge, colors, Empty, ErrorText, Loading, styles } from "../../components/ui";
import { api } from "../../lib/api";
import { formatPhone, formatWhen, LEAD_STATUS } from "../../lib/format";
import type { Lead, LeadStatus } from "../../lib/types";

const FILTERS: (LeadStatus | "")[] = ["", "new", "qualified", "booked", "converted", "lost"];

export default function Leads() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<LeadStatus | "">("");
  const params = new URLSearchParams({ pageSize: "100" });
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  const query = useQuery({ queryKey: ["leads", params.toString()], queryFn: () => api<{ leads: Lead[] }>(`/leads?${params}`) });

  return (
    <View style={styles.screen}>
      <View style={{ padding: 16, paddingBottom: 8, gap: 10 }}>
        <TextInput
          accessibilityLabel="Search by name, number or city"
          placeholder="Search name, number or city"
          placeholderTextColor="#64748B"
          style={styles.input}
          value={q}
          onChangeText={setQ}
          autoCorrect={false}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((f) => (
            <Pressable
              key={f || "all"}
              accessibilityRole="button"
              accessibilityState={{ selected: status === f }}
              onPress={() => setStatus(f)}
              style={{
                minHeight: 36,
                paddingHorizontal: 14,
                borderRadius: 999,
                justifyContent: "center",
                backgroundColor: status === f ? colors.brand : "#fff",
                borderWidth: 1,
                borderColor: status === f ? colors.brand : "#CBD5E1",
              }}
            >
              <Text style={{ color: status === f ? "#fff" : colors.ink, fontWeight: "600" }}>{f ? LEAD_STATUS[f].label : "All"}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ErrorText error={query.error} />
      {query.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={query.data?.leads ?? []}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          ListEmptyComponent={<Empty>No leads match.</Empty>}
          onRefresh={() => query.refetch()}
          refreshing={query.isRefetching}
          renderItem={({ item: l }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/lead/${l.id}`)}
              style={({ pressed }) => ({ paddingVertical: 12, gap: 4, backgroundColor: pressed ? "#F8FAFC" : "transparent" })}
            >
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <Text style={{ fontWeight: "600", color: colors.ink, flex: 1 }}>{l.name ?? formatPhone(l.phone)}</Text>
                <Badge tone={LEAD_STATUS[l.status]} />
              </View>
              <Text style={styles.muted}>
                {[l.city, l.treatmentInterest ?? l.concern, formatWhen(l.updatedAt)].filter(Boolean).join(" · ")}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
