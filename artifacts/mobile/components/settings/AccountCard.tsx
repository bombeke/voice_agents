import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { fill } from "@/helpers/format";
import { Text, View } from "react-native";

const a = strings.settings.account;

interface AccountCardProps {
  name: string;
  email?: string;
  role: string;
  org?: string;
  /** "Casdoor SSO"; no chip when unknown. */
  method?: string;
  offlineSessionDays: number;
  project?: string;
  /** Without it the switch button is disabled (no project picker yet). */
  onSwitchProject?: () => void;
}

/** Who is signed in, how, and which project the device captures for. */
export function AccountCard({
  name,
  email,
  role,
  org,
  method,
  offlineSessionDays,
  project,
  onSwitchProject,
}: AccountCardProps) {
  return (
    <Card className="gap-3.5">
      <View className="flex-row items-center gap-3">
        <View className="w-[52px] h-[52px] rounded-full bg-primary-soft items-center justify-center">
          <Icon name="user" size={26} color={colors.primary} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="type-title text-text" numberOfLines={1}>
            {name}
          </Text>
          {email ? (
            <Text className="type-body-small text-text-muted" numberOfLines={1}>
              {email}
            </Text>
          ) : null}
          <Text className="type-body-small text-text-muted" numberOfLines={1}>
            {org ? fill(a.roleAndOrg, { role, org }) : role}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        {method ? (
          <Chip
            label={method}
            icon={
              <Icon
                name="shield"
                size={13}
                color={colors.text}
                strokeWidth={2.2}
              />
            }
          />
        ) : null}
        <Chip label={fill(a.offlineSession, { days: offlineSessionDays })} />
      </View>

      <Button
        variant="secondary"
        disabled={!onSwitchProject}
        onPress={onSwitchProject}
      >
        {project ? fill(a.switchProject, { project }) : a.noProject}
      </Button>
    </Card>
  );
}
