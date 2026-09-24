import { OptionSheet } from "@/components/ui/OptionSheet";
import { useState } from "react";
import { SettingsRow } from "./SettingsRow";

interface ChoiceRowProps<T extends string | number> {
  label: string;
  hint?: string;
  options: readonly T[];
  value: T;
  labels: Record<T, string>;
  onChange: (value: T) => void;
}

/** Nav row showing the current choice; tapping it opens the options sheet. */
export function ChoiceRow<T extends string | number>({
  label,
  hint,
  options,
  value,
  labels,
  onChange,
}: ChoiceRowProps<T>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsRow
        label={label}
        hint={hint}
        trailing={{
          kind: "nav",
          value: labels[value],
          onPress: () => setOpen(true),
        }}
      />
      <OptionSheet
        title={label}
        options={open ? options : null}
        value={value}
        labels={labels}
        onPick={(next) => {
          setOpen(false);
          onChange(next);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
