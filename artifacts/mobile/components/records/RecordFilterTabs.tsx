import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import {
  RECORD_FILTERS,
  type RecordCounts,
  type RecordFilter,
} from "@/helpers/records";

interface RecordFilterTabsProps {
  value: RecordFilter;
  onChange: (filter: RecordFilter) => void;
  counts: RecordCounts;
}

/** "All · 14", "Pending · 3", "Flagged · 1". */
export function RecordFilterTabs({
  value,
  onChange,
  counts,
}: RecordFilterTabsProps) {
  const f = strings.records.filters;
  return (
    <SegmentedControl
      role="tablist"
      label={strings.records.filterLabel}
      options={RECORD_FILTERS}
      value={value}
      onChange={onChange}
      labels={{
        all: fill(f.all, { count: counts.all }),
        pending: fill(f.pending, { count: counts.pending }),
        flagged: fill(f.flagged, { count: counts.flagged }),
      }}
    />
  );
}
