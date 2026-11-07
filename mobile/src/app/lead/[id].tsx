import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { CallRow } from "../../components/CallRow";
import { Badge, Button, Card, colors, ErrorText, Loading, SectionTitle, styles } from "../../components/ui";
import { api } from "../../lib/api";
import { APPT_STATUS, formatDateTime, formatPhone, LEAD_STATUS } from "../../lib/format";
import type { Appointment, AppointmentStatus, Call, Lead, LeadStatus } from "../../lib/types";

const STATUSES: LeadStatus[] = ["new", "qualified", "booked", "converted", "lost"];

export default function LeadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => api<{ lead: Lead; calls: Call[]; appointments: Appointment[] }>(`/leads/${id}`),
  });
  const [notes, setNotes] = useState("");
  useEffect(() => setNotes(data?.lead.notes ?? ""), [data?.lead.notes]);

  const update = useMutation({
    mutationFn: (patch: Partial<Lead>) => api(`/leads/${id}`, { method: "PATCH", json: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
  const setAppt = useMutation({
    mutationFn: ({ apptId, status }: { apptId: string; status: AppointmentStatus }) => api(`/appointments/${apptId}`, { method: "PATCH", json: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead", id] }),
  });

  if (isLoading) return <Loading />;
  if (!data) return <ErrorText error={error ?? new Error("Lead not found")} />;
  const { lead } = data;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: lead.name ?? "Lead" }} />
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.ink }}>{lead.name ?? "Unknown name"}</Text>
        <Text style={styles.muted}>{formatPhone(lead.phone)}</Text>
      </View>
      <Button title="Call" variant="primary" onPress={() => Linking.openURL(`tel:${lead.phone}`)} />
      <ErrorText error={update.error ?? setAppt.error} />

      <Card style={{ gap: 6 }}>
        <SectionTitle>Details</SectionTitle>
        {[
          ["City", lead.city],
          ["Concern", lead.concern],
          ["For how long", lead.hairLossDuration],
          ["Interested in", lead.treatmentInterest],
          ["Budget", lead.budget],
          ["Source", lead.source],
        ].map(([k, v]) => (
          <View key={k} style={[styles.row, { justifyContent: "space-between" }]}>
            <Text style={styles.muted}>{k}</Text>
            <Text style={{ color: colors.ink, fontWeight: "600", flexShrink: 1, textAlign: "right" }}>{v || "—"}</Text>
          </View>
        ))}
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionTitle>Stage</SectionTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {STATUSES.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="radio"
              accessibilityState={{ selected: lead.status === s }}
              onPress={() => update.mutate({ status: s })}
              style={{
                minHeight: 40,
                paddingHorizontal: 14,
                borderRadius: 999,
                justifyContent: "center",
                borderWidth: 1,
                borderColor: lead.status === s ? colors.brand : "#CBD5E1",
                backgroundColor: lead.status === s ? colors.brand : "#fff",
              }}
            >
              <Text style={{ color: lead.status === s ? "#fff" : colors.ink, fontWeight: "600" }}>{LEAD_STATUS[s].label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionTitle>Consultations</SectionTitle>
        {data.appointments.length === 0 && <Text style={styles.muted}>None booked yet. Book from the web dashboard.</Text>}
        {data.appointments.map((a) => (
          <View key={a.id} style={{ backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, gap: 8 }}>
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Text style={{ fontWeight: "700", color: colors.ink }}>{formatDateTime(a.startsAt)}</Text>
              <Badge tone={APPT_STATUS[a.status]} />
            </View>
            {a.status === "scheduled" && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button title="Visited" onPress={() => setAppt.mutate({ apptId: a.id, status: "completed" })} />
                <Button title="No-show" onPress={() => setAppt.mutate({ apptId: a.id, status: "no_show" })} />
                <Button title="Cancel" onPress={() => setAppt.mutate({ apptId: a.id, status: "cancelled" })} />
              </View>
            )}
          </View>
        ))}
      </Card>

      <Card style={{ gap: 10 }}>
        <Text nativeID="leadNotes" style={styles.sectionTitle}>
          Notes
        </Text>
        <TextInput
          accessibilityLabelledBy="leadNotes"
          multiline
          placeholder="Notes for the team"
          placeholderTextColor="#64748B"
          style={[styles.input, { minHeight: 88, paddingTop: 10, textAlignVertical: "top" }]}
          value={notes}
          onChangeText={setNotes}
        />
        <Button title="Save notes" onPress={() => update.mutate({ notes: notes || null })} disabled={update.isPending || notes === (lead.notes ?? "")} />
      </Card>

      <Card>
        <SectionTitle>Calls from this number</SectionTitle>
        {data.calls.map((c, i) => (
          <View key={c.id}>
            {i > 0 && <View style={styles.divider} />}
            <CallRow call={c} />
          </View>
        ))}
        {data.calls.length === 0 && (
          <Pressable onPress={() => router.back()}>
            <Text style={styles.muted}>No calls linked yet.</Text>
          </Pressable>
        )}
      </Card>
    </ScrollView>
  );
}
