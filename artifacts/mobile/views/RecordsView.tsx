import { RecordFilterTabs } from "@/components/records/RecordFilterTabs";
import { RecordRow } from "@/components/records/RecordRow";
import { RecordsHeader } from "@/components/records/RecordsHeader";
import { SyncBanner } from "@/components/records/SyncBanner";
import { CardDivider } from "@/components/ui/Card";
import { InfoNote } from "@/components/ui/InfoNote";
import { strings } from "@/constants/Strings";
import { findRecord, type RecordFilter } from "@/helpers/records";
import { useRecords } from "@/hooks/useRecords";
import { captures$ } from "@/services/storage/CaptureStore";
import { useEffect, useRef, useState } from "react";
import { SectionList, Text, View } from "react-native";

/** How long a record opened from another tab stays tinted. */
const HIGHLIGHT_MS = 2500;

/** Rows share one bordered card per day; only its ends are rounded. */
const cardEdge = (index: number, count: number) =>
  `${index === 0 ? "border-t rounded-t-2xl" : ""} ${
    index === count - 1 ? "border-b rounded-b-2xl" : ""
  }`;

interface RecordsViewProps {
  /** Capture id or asset code to scroll to and highlight (the Map's "View record"). */
  focusId?: string;
  /** Tab to open on, e.g. "pending" from Home's pending badge. */
  filter?: RecordFilter;
}

/**
 * Records tab: the upload queue with "Sync now", All / Pending / Flagged tabs,
 * search, and every record on the device grouped by day.
 */
export function RecordsView({
  focusId,
  filter: initialFilter,
}: RecordsViewProps) {
  const {
    counts,
    sections,
    online,
    syncing,
    sync,
    filter,
    setFilter,
    query,
    setQuery,
    searchOpen,
    toggleSearch,
    reset,
  } = useRecords(initialFilter);
  const list = useRef<SectionList>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (initialFilter) setFilter(initialFilter);
  }, [initialFilter, setFilter]);

  // Reads the store once per link, so later store updates don't re-scroll.
  useEffect(() => {
    if (!focusId) return;
    const record = findRecord(captures$.peek(), focusId);
    if (!record) return;
    reset();
    setHighlightId(record.id);
  }, [focusId, reset]);

  useEffect(() => {
    if (!highlightId) return;
    const sectionIndex = sections.findIndex((s) =>
      s.data.some((c) => c.id === highlightId),
    );
    if (sectionIndex >= 0) {
      list.current?.scrollToLocation({
        sectionIndex,
        itemIndex: sections[sectionIndex].data.findIndex(
          (c) => c.id === highlightId,
        ),
        viewPosition: 0.3,
      });
    }
    const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
    // Scroll once per highlight; the sections settle with it after reset().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId]);

  const e = strings.records.empty;
  const empty = counts.all === 0 ? e.all : query.trim() ? e.search : e[filter];

  return (
    <SectionList
      ref={list}
      className="flex-1 bg-background"
      contentContainerClassName="pt-safe-offset-6 pb-10"
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      // Rows outside the rendered window can't be scrolled to; the tint still shows.
      onScrollToIndexFailed={() => {}}
      ListHeaderComponent={
        <View className="px-5 gap-4 pb-1">
          <RecordsHeader
            searchOpen={searchOpen}
            onToggleSearch={toggleSearch}
            query={query}
            onChangeQuery={setQuery}
          />
          <SyncBanner
            pending={counts.pending}
            failed={counts.failed}
            online={online}
            syncing={syncing}
            onSync={sync}
          />
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
          <RecordRow record={item} highlighted={item.id === highlightId} />
        </View>
      )}
    />
  );
}
