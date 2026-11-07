import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { callerLabel, formatDuration, formatWhen, intentLabel, OUTCOME } from "../lib/format";
import type { Call } from "../lib/types";
import { Badge, colors, styles } from "./ui";

export function CallRow({ call }: { call: Call }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Call from ${callerLabel(call)}, ${formatWhen(call.startedAt)}`}
      onPress={() => router.push(`/call/${call.id}`)}
      style={({ pressed }) => ({ paddingVertical: 12, gap: 6, backgroundColor: pressed ? "#F8FAFC" : "transparent" })}
    >
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Text style={{ fontWeight: "600", color: colors.ink, flex: 1 }} numberOfLines={1}>
          {callerLabel(call)}
        </Text>
        {call.outcome && <Badge tone={OUTCOME[call.outcome]} />}
      </View>
      <Text style={styles.muted}>
        {formatWhen(call.startedAt)} · {intentLabel(call.intent)} · {call.language ?? "—"} · {formatDuration(call.durationSecs)}
      </Text>
    </Pressable>
  );
}
