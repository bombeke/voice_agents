import { Icon } from "@/components/ui/Icons";
import { SearchBar } from "@/components/ui/SearchBar";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { Pressable, Text, View } from "react-native";

interface RecordsHeaderProps {
  searchOpen: boolean;
  onToggleSearch: () => void;
  query: string;
  onChangeQuery: (text: string) => void;
}

/** "Records" title with a round search button that opens a search field below. */
export function RecordsHeader({
  searchOpen,
  onToggleSearch,
  query,
  onChangeQuery,
}: RecordsHeaderProps) {
  const r = strings.records;
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text accessibilityRole="header" className="type-h1 text-text">
          {r.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? r.closeSearch : r.openSearch}
          onPress={onToggleSearch}
          className="w-11 h-11 items-center justify-center rounded-full bg-surface border border-border active:bg-surface-muted"
        >
          <Icon
            name={searchOpen ? "close" : "search"}
            size={20}
            color={colors.text}
          />
        </Pressable>
      </View>
      {searchOpen ? (
        <SearchBar
          value={query}
          onChangeText={onChangeQuery}
          label={r.searchLabel}
          placeholder={r.searchPlaceholder}
          clearLabel={r.clearSearch}
          autoFocus
        />
      ) : null}
    </View>
  );
}
