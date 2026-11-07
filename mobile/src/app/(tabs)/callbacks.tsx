import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, Linking, Text, View } from "react-native";
import { Button, colors, Empty, ErrorText, Loading, styles } from "../../components/ui";
import { api } from "../../lib/api";
import { formatPhone, formatWhen } from "../../lib/format";
import type { Callback } from "../../lib/types";

export default function Callbacks() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["callbacks", "pending"], queryFn: () => api<{ callbacks: Callback[] }>("/callbacks?status=pending") });
  const done = useMutation({
    mutationFn: (id: string) => api(`/callbacks/${id}`, { method: "PATCH", json: { status: "done" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["callbacks"] }),
  });

  if (query.isLoading) return <Loading />;
  return (
    <View style={styles.screen}>
      <ErrorText error={query.error ?? done.error} />
      <FlatList
        data={query.data?.callbacks ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        onRefresh={() => query.refetch()}
        refreshing={query.isRefetching}
        ListEmptyComponent={<Empty>No one is waiting for a callback.</Empty>}
        renderItem={({ item: c }) => (
          <View style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontWeight: "700", color: colors.ink }}>{c.name ?? formatPhone(c.phone)}</Text>
              <Text style={styles.body}>{c.reason ?? "No reason given"}</Text>
              <Text style={styles.muted}>{formatWhen(c.createdAt)}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title={`Call ${formatPhone(c.phone)}`} variant="primary" onPress={() => Linking.openURL(`tel:${c.phone}`)} />
              </View>
              <Button title="Done" onPress={() => done.mutate(c.id)} disabled={done.isPending} />
            </View>
          </View>
        )}
      />
    </View>
  );
}
