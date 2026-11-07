import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, TextInput, View } from "react-native";
import { CallRow } from "../../components/CallRow";
import { Empty, ErrorText, Loading, styles } from "../../components/ui";
import { api } from "../../lib/api";
import type { Call } from "../../lib/types";

const PAGE = 25;

export default function Calls() {
  const [q, setQ] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["calls", "infinite", q],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<{ calls: Call[]; total: number; page: number }>(`/calls?page=${pageParam}&pageSize=${PAGE}${q ? `&q=${encodeURIComponent(q)}` : ""}`),
    getNextPageParam: (last) => (last.page * PAGE < last.total ? last.page + 1 : undefined),
  });
  const items = query.data?.pages.flatMap((p) => p.calls) ?? [];

  return (
    <View style={styles.screen}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <TextInput
          accessibilityLabel="Search by name, number or city"
          placeholder="Search name, number or city"
          placeholderTextColor="#64748B"
          style={styles.input}
          value={q}
          onChangeText={setQ}
          autoCorrect={false}
        />
      </View>
      <ErrorText error={query.error} />
      {query.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          renderItem={({ item }) => <CallRow call={item} />}
          ListEmptyComponent={<Empty>No calls found.</Empty>}
          onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
          onRefresh={() => query.refetch()}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
        />
      )}
    </View>
  );
}
