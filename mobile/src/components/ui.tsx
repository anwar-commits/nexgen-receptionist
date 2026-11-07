import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { Tone } from "../lib/format";

export const colors = {
  ground: "#F5F7FA",
  card: "#FFFFFF",
  border: "#E2E8F0",
  ink: "#0F172A",
  muted: "#475569",
  brand: "#0F766E",
  brandDark: "#115E59",
  brandSoft: "#E6F4F1",
  brandInk: "#134E4A",
  warn: "#B45309",
  warnSoft: "#FFF4E5",
  danger: "#991B1B",
};

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ tone }: { tone: Tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.badgeText, { color: tone.fg }]}>{tone.label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "secondary",
  disabled,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: pressed ? colors.brandDark : colors.brand } : { backgroundColor: pressed ? "#F1F5F9" : "#fff", borderWidth: 1, borderColor: "#CBD5E1" },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.buttonText, { color: primary ? "#fff" : colors.ink }]}>{title}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </Text>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Text style={{ color: colors.danger }}>{error instanceof Error ? error.message : "Something went wrong"}</Text>
    </View>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 16, gap: 16 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 16 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" },
  badgeText: { fontSize: 13, fontWeight: "600" },
  button: { minHeight: 44, borderRadius: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 15, fontWeight: "600" },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  center: { padding: 32, alignItems: "center" },
  error: { backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12 },
  empty: { color: colors.muted, textAlign: "center", padding: 24 },
  muted: { color: colors.muted, fontSize: 13 },
  body: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  divider: { height: 1, backgroundColor: colors.border },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: "#fff",
  },
});
