import { Button } from "@/components/ui/Button";
import { InfoNote } from "@/components/ui/InfoNote";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import * as Haptics from "expo-haptics";
import { Alert, Platform, View } from "react-native";

const so = strings.settings.signOut;

interface SignOutPanelProps {
  /** Records still on this device only; warns before signing out. */
  pending: number;
  onSignOut: () => void | Promise<void>;
}

/** Unsynced-records warning and the confirmed "Sign out" button. */
export function SignOutPanel({ pending, onSignOut }: SignOutPanelProps) {
  const confirm = () =>
    Alert.alert(so.confirmTitle, so.confirmMessage, [
      { text: so.cancel, style: "cancel" },
      {
        text: so.button,
        style: "destructive",
        onPress: () => {
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
          return onSignOut();
        },
      },
    ]);

  return (
    <View className="gap-2">
      {pending > 0 ? (
        <InfoNote tone="warning">
          {pending === 1
            ? so.unsyncedOne
            : fill(so.unsynced, { count: pending })}
        </InfoNote>
      ) : null}
      <Button variant="danger" onPress={confirm}>
        {so.button}
      </Button>
    </View>
  );
}
