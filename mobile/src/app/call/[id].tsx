import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, ScrollView, Text, TextInput, View } from "react-native";
import { Badge, Button, Card, colors, ErrorText, Loading, SectionTitle, styles } from "../../components/ui";
import { api, audioUrl } from "../../lib/api";
import { formatDateTime, formatDuration, formatPhone, formatWhen, intentLabel, LEAD_STATUS, OUTCOME } from "../../lib/format";
import type { Appointment, Call, Lead, TranscriptTurn } from "../../lib/types";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={{ width: "50%", paddingVertical: 6, paddingRight: 8 }}>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
      <Text style={{ fontWeight: "600", color: colors.ink }}>{value || "Not shared"}</Text>
    </View>
  );
}

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ["call", id],
    queryFn: () => api<{ call: Call; transcript: TranscriptTurn[]; lead: Lead | null; appointments: Appointment[] }>(`/calls/${id}`),
  });
  const [notes, setNotes] = useState("");
  useEffect(() => setNotes(data?.call.staffNotes ?? ""), [data?.call.staffNotes]);
  const saveNotes = useMutation({
    mutationFn: () => api(`/calls/${id}`, { method: "PATCH", json: { staffNotes: notes || null } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call", id] }),
  });

  if (isLoading) return <Loading />;
  if (!data) return <ErrorText error={error ?? new Error("Call not found")} />;
  const { call, transcript, lead, appointments } = data;
  const next = appointments.find((a) => a.status === "scheduled");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: call.callerName ?? formatPhone(call.callerPhone) }} />
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.ink }}>{[call.callerName, formatPhone(call.callerPhone)].filter(Boolean).join(" · ")}</Text>
        <View style={[styles.row, { flexWrap: "wrap", gap: 8 }]}>
          {call.outcome && <Badge tone={OUTCOME[call.outcome]} />}
          {call.language && <Badge tone={{ label: call.language, bg: "#F1F5F9", fg: "#334155" }} />}
        </View>
        <Text style={styles.muted}>
          {formatWhen(call.startedAt)} · {formatDuration(call.durationSecs)} · {intentLabel(call.intent)}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {call.callerPhone && (
          <View style={{ flex: 1 }}>
            <Button title="Call back" variant="primary" onPress={() => Linking.openURL(`tel:${call.callerPhone}`)} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Button title="Play recording" onPress={() => Linking.openURL(audioUrl(call.id))} />
        </View>
      </View>

      <Card>
        <SectionTitle>AI summary</SectionTitle>
        <Text style={styles.body}>{call.summary ?? "No summary yet."}</Text>
      </Card>

      <Card>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <SectionTitle>Lead captured</SectionTitle>
          {lead && <Badge tone={LEAD_STATUS[lead.status]} />}
        </View>
        {lead ? (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              <Info label="Name" value={lead.name} />
              <Info label="City" value={lead.city} />
              <Info label="Concern" value={lead.concern} />
              <Info label="For how long" value={lead.hairLossDuration} />
              <Info label="Interested in" value={lead.treatmentInterest} />
              <Info label="Budget" value={lead.budget} />
            </View>
            {next && (
              <View style={{ backgroundColor: colors.brandSoft, borderRadius: 10, padding: 12, marginTop: 8 }}>
                <Text style={{ color: colors.brandInk }}>
                  <Text style={{ fontWeight: "700" }}>Booked: </Text>
                  {formatDateTime(next.startsAt)} · {next.doctorName}
                </Text>
              </View>
            )}
            <View style={{ marginTop: 12 }}>
              <Button title="Open lead" onPress={() => router.push(`/lead/${lead.id}`)} />
            </View>
          </>
        ) : (
          <Text style={styles.muted}>No lead details were captured on this call.</Text>
        )}
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle>Transcript</SectionTitle>
        {transcript.length === 0 && <Text style={styles.muted}>No transcript for this call.</Text>}
        {transcript.map((t) => {
          const agent = t.role === "agent";
          return (
            <View
              key={t.id}
              style={{
                alignSelf: agent ? "flex-start" : "flex-end",
                maxWidth: "85%",
                backgroundColor: agent ? colors.brandSoft : "#F1F5F9",
                borderRadius: 14,
                borderTopLeftRadius: agent ? 4 : 14,
                borderTopRightRadius: agent ? 14 : 4,
                padding: 12,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: agent ? colors.brandInk : colors.muted, marginBottom: 2 }}>
                {agent ? "Riya" : "Caller"} · {mmss(t.timeSecs)}
              </Text>
              <Text style={styles.body}>{t.message}</Text>
            </View>
          );
        })}
      </Card>

      <Card style={{ gap: 10 }}>
        <Text nativeID="notesLabel" style={styles.sectionTitle}>
          Staff notes
        </Text>
        <TextInput
          accessibilityLabelledBy="notesLabel"
          multiline
          placeholder="Add a note for the counsellor"
          placeholderTextColor="#64748B"
          style={[styles.input, { minHeight: 88, paddingTop: 10, textAlignVertical: "top" }]}
          value={notes}
          onChangeText={setNotes}
        />
        <ErrorText error={saveNotes.error} />
        <Button title={saveNotes.isSuccess && notes === (call.staffNotes ?? "") ? "Saved" : "Save note"} onPress={() => saveNotes.mutate()} disabled={saveNotes.isPending || notes === (call.staffNotes ?? "")} />
      </Card>
    </ScrollView>
  );
}
