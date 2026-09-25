import { LocationSummary } from "@/components/camera/LocationSummary";
import { ConditionHistory } from "@/components/records/ConditionHistory";
import { PhotoPager } from "@/components/records/PhotoPager";
import { RecordAttributes } from "@/components/records/RecordAttributes";
import { RecordHeader } from "@/components/records/RecordHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { InfoNote } from "@/components/ui/InfoNote";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import { useRecordDetail } from "@/hooks/useRecordDetail";
import { Routes } from "@/services/Routes";
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

const d = strings.records.detail;

/**
 * One saved record (design/screens/Record detail.png): its photos, the
 * attributes with their source, the comment, the stamped fix and the asset's
 * condition history, with "Show on map" and "Edit record" at the bottom.
 * `id` is a capture id or an asset code.
 */
export function RecordDetailView({ id }: { id: string }) {
  const router = useRouter();
  const detail = useRecordDetail(id);

  const back = () =>
    router.canGoBack() ? router.back() : router.navigate(Routes.RECORDS);

  if (!detail) {
    return (
      <View className="flex-1 bg-background pt-safe-offset-6 px-5 gap-4">
        <InfoNote>{d.notFound}</InfoNote>
        <Button variant="secondary" onPress={back}>
          {d.backToRecords}
        </Button>
      </View>
    );
  }

  const { summary, record, history, own } = detail;

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-6"
        showsVerticalScrollIndicator={false}
      >
        <PhotoPager
          photos={record.photos}
          category={record.category}
          onBack={back}
        />
        <View className="px-5 pt-4 gap-4">
          <RecordHeader
            record={record}
            syncStatus={summary.syncStatus}
            flagged={summary.flagged}
          />
          {!own && summary.capturedBy ? (
            <Text className="type-body-small text-text-muted">
              {fill(d.capturedBy, { name: summary.capturedBy.name })}
            </Text>
          ) : null}
          <RecordAttributes record={record} />
          {record.comment ? (
            <Card>
              <View accessibilityLabel={d.comment} className="gap-1">
                <Text
                  accessibilityRole="header"
                  className="type-title text-text"
                >
                  {d.comment}
                </Text>
                <Text className="type-body text-text">{record.comment}</Text>
              </View>
            </Card>
          ) : null}
          <View accessibilityLabel={d.location}>
            <LocationSummary location={record.location} />
          </View>
          <ConditionHistory entries={history} />
        </View>
      </ScrollView>

      {own || record.assetId ? (
        <View className="flex-row gap-3 px-5 pt-3 pb-safe-offset-3 bg-background border-t border-border">
          {record.assetId ? (
            <Button
              variant="secondary"
              className="flex-1"
              onPress={() =>
                router.navigate({
                  pathname: Routes.MAP,
                  params: { id: record.assetId },
                })
              }
            >
              {d.showOnMap}
            </Button>
          ) : null}
          {/* Another enumerator's record is theirs to edit, not the reviewer's. */}
          {own ? (
            <Button
              className="flex-[1.5]"
              onPress={() =>
                router.push({
                  pathname: Routes.CAPTURE_TAG,
                  params: { recordId: record.id },
                })
              }
            >
              {d.edit}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
