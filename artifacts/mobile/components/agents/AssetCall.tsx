import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { colors } from "@/constants/theme";
import { FontAwesome6 } from "@expo/vector-icons";
import { Component, ReactNode } from "react";
import { Text, View } from "react-native";
import { useSipApi } from "../../hooks/useSipApiCall";

const calls = [
  {
    id: 1,
    tel: "+12762700060",
    title: "Information",
    subtitle: "",
    description: "Are you stuck? Dial the agent for more information.",
  },
  {
    id: 2,
    tel: "125",
    title: "Emergency",
    description: "Are you in an emergency? Dial the agent for Help",
  },
  {
    id: 3,
    tel: "126",
    title: "Ambulance",
    description:
      "Do you need ambulance services or directions? Dial the agent for ambulance services available in your location.",
  },
];

export const AssetCall = ({ children }: ReactNode | Component | any) => {
  const { initiateCall, terminateCall, callStatus, activeCall } = useSipApi();

  const handleCall = (number: string | null) => {
    if (callStatus === "in-call") {
      terminateCall();
    } else {
      initiateCall(number);
    }
  };

  const getIcon = () => {
    switch (callStatus) {
      case "in-call":
        return (
          <FontAwesome6
            name="phone-volume"
            color={colors.onPrimary}
            size={26}
          />
        );
      case "calling":
        return (
          <FontAwesome6 name="phone-slash" color={colors.onPrimary} size={26} />
        );
      default:
        return <FontAwesome6 name="phone" color={colors.onPrimary} size={26} />;
    }
  };

  const getButtonText = (tel: string | null = null) => {
    switch (callStatus) {
      case "in-call":
        return `End Call ${tel ?? ""}`;
      case "calling":
        return `Calling ${tel ?? ""}`;
      default:
        return `Call ${tel ?? ""}`;
    }
  };

  return (
    <View className="flex-1 mt-[150px] items-start justify-center">
      {children}
      {calls.map((call, i) => (
        <Card key={i} className="m-2 self-stretch gap-2.5">
          <Text className="type-h2 text-text">{call.title}</Text>
          {call.subtitle ? (
            <Text className="type-body text-text-muted">{call.subtitle}</Text>
          ) : null}
          <Text className="type-body-small text-text">{call.description}</Text>
          <Button
            className="self-end"
            onPress={() => handleCall(call.tel)}
            disabled={call.tel === activeCall && callStatus === "calling"}
          >
            {getIcon()}
            <Text className="type-body-strong text-on-primary">
              {getButtonText()}
            </Text>
          </Button>
        </Card>
      ))}
    </View>
  );
};
