import { Card, CardDivider } from "@/components/ui/Card";
import { Children, Fragment, ReactNode } from "react";
import { Text, View } from "react-native";

/** Overline heading of a settings group. */
export function SettingsHeading({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      className="type-overline text-text-muted mx-1"
    >
      {children}
    </Text>
  );
}

interface SettingsSectionProps {
  title: string;
  /** Rows; a divider goes between each. Falsy children are skipped. */
  children: ReactNode;
}

/** Overline heading above a flush card of setting rows. */
export function SettingsSection({ title, children }: SettingsSectionProps) {
  const rows = Children.toArray(children);
  return (
    <View className="gap-2">
      <SettingsHeading>{title}</SettingsHeading>
      <Card variant="flush">
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? <CardDivider /> : null}
            {row}
          </Fragment>
        ))}
      </Card>
    </View>
  );
}
