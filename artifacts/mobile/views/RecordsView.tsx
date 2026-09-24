import { RecordFilterTabs } from "@/components/records/RecordFilterTabs";
import { RecordRow } from "@/components/records/RecordRow";
import { RecordsHeader } from "@/components/records/RecordsHeader";
import { SyncBanner } from "@/components/records/SyncBanner";
import { CardDivider } from "@/components/ui/Card";
import { InfoNote } from "@/components/ui/InfoNote";
import { strings } from "@/constants/Strings";
import type { RecordFilter } from "@/helpers/records";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { colors } from "@/constants/theme";
import { type RecordScope, useRecords } from "@/hooks/useRecords";
import { Routes } from "@/services/Routes";
import type { CaptureSummary } from "@/types/Capture";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, SectionList, Text, View } from "react-native";

const SCOPES: readonly RecordScope[] = ["mine", "team"];

/** Rows share one bordered card per day; only its ends are rounded. */
const cardEdge = (index: number, count: number) =>
  `${index === 0 ? "border-t rounded-t-2xl" : ""} ${
    index === count - 1 ? "border-b rounded-b-2xl" : ""
  }`;

interface RecordsViewProps {
  /** Tab to open on, e.g. "pending" from Home's pending badge. */
  filter?: RecordFilter;
  /** Supervisors and admins can switch to their team's records. */
  canSeeTeam?: boolean;
}

/**
 * Records tab: the upload queue with "Sync now", All / Pending / Flagged tabs,
 * search, and every record on the device grouped by day. A row opens the
 * record's detail screen. Supervisors can switch to their team's records,
 * fetched from the server (pull to refresh) and kept for offline use.
 */
export function RecordsView({
  filter: initialFilter,
  canSeeTeam = false,
}: RecordsViewProps) {
  const router = useRouter();
  const [scope, setScope] = useState<RecordScope>("mine");
  const team = scope === "team";
  const {
    counts,
    ownCounts,
    sections,
    online,
    syncing,
    sync,
    refreshing,
    refreshTeam,
    filter,
    setFilter,
    query,
    setQuery,
    searchOpen,
    toggleSearch,
  } = useRecords(initialFilter, scope);

  // Same instance for every row, so the memoised rows skip re-rendering.
  const openRecord = useCallback(
    ({ id }: CaptureSummary) =>
      router.push({ pathname: Routes.RECORD_DETAIL, params: { id } }),
    [router],
  );

  useEffect(() => {
    if (initialFilter) setFilter(initialFilter);
  }, [initialFilter, setFilter]);

  // The team list is fetched when opened (online), then kept for offline use.
  useEffect(() => {
    if (team) refreshTeam();
  }, [team, refreshTeam]);

  const e = strings.records.empty;
  const empty =
    counts.all === 0
      ? team
        ? e.team
        : e.all
      : query.trim()
        ? e.search
        : e[filter];

  return (
    <SectionList
      className="flex-1 bg-background"
      contentContainerClassName="pt-safe-offset-6 pb-10"
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        team ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshTeam}
            tintColor={colors.primary}
          />
        ) : undefined
      }
      ListHeaderComponent={
        <View className="px-5 gap-4 pb-1">
          <RecordsHeader
            searchOpen={searchOpen}
            onToggleSearch={toggleSearch}
            query={query}
            onChangeQuery={setQuery}
          />
          {canSeeTeam ? (
            <SegmentedControl
              role="tablist"
              label={strings.records.scopes.label}
              options={SCOPES}
              value={scope}
              onChange={setScope}
              labels={{
                mine: strings.records.scopes.mine,
                team: strings.records.scopes.team,
              }}
            />
          ) : null}
          {/* Uploading is about the user's own records, so it stays theirs. */}
          {team ? null : (
            <SyncBanner
              pending={ownCounts.pending}
              failed={ownCounts.failed}
              online={online}
              syncing={syncing}
              onSync={sync}
            />
          )}
          <RecordFilterTabs
            value={filter}
            onChange={setFilter}
            counts={counts}
          />
        </View>
      }
      ListEmptyComponent={
        <View className="px-5 pt-4">
          <InfoNote>{empty}</InfoNote>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text
          accessibilityRole="header"
          className="type-overline text-text-muted px-5 pt-5 pb-2"
        >
          {section.title}
        </Text>
      )}
      renderItem={({ item, index, section }) => (
        <View
          className={`mx-5 bg-surface border-x border-border overflow-hidden ${cardEdge(index, section.data.length)}`}
        >
          {index > 0 ? <CardDivider /> : null}
          <RecordRow record={item} onPress={openRecord} showOwner={team} />
        </View>
      )}
    />
  );
}
