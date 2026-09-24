import { Chip } from "@/components/ui/Chip";
import { strings } from "@/constants/Strings";
import { REVIEW_FILTERS, type ReviewFilter } from "@/helpers/reviewQueue";
import { View } from "react-native";

interface ReviewFilterChipsProps {
  value: ReviewFilter;
  onChange: (filter: ReviewFilter) => void;
}

/** "All reasons", "Low AI confidence", "GPS", "Duplicates": wrapping pills, one selected. */
export function ReviewFilterChips({ value, onChange }: ReviewFilterChipsProps) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={strings.review.filterLabel}
      className="flex-row flex-wrap gap-2.5"
    >
      {REVIEW_FILTERS.map((filter) => (
        <Chip
          key={filter}
          role="tab"
          label={strings.review.filters[filter]}
          selected={filter === value}
          onPress={() => onChange(filter)}
        />
      ))}
    </View>
  );
}
