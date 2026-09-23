import { Stack } from "expo-router";

/** A detail opened from another tab still has the list to go back to. */
export const unstable_settings = { initialRouteName: "index" };

/** The Records list and the record detail pushed over it (no tab bar there). */
export default function RecordsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
