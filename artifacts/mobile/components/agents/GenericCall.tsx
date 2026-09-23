import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { ReactNode, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "@/constants/theme";

import { Relay } from "@signalwire/react-native";
import useRelayClient from "../../hooks/useRelayClient";
import { AssetCall } from "./AssetCall";
import { CallRTCView } from "./CallRTCView";

export const GenericCall = (): ReactNode | Promise<ReactNode> => {
  const { client, connected, call } = useRelayClient(
    {
      project: "",
      token: "",
    },
    function onRinging(call) {
      const { remoteCallerName, remoteCallerNumber } = call.options;
      const caller = remoteCallerName || remoteCallerNumber;
      Alert.alert(
        "Inbound Call",
        `Call from ${caller}`,
        [
          {
            text: "Reject",
            onPress: () => call.hangup(),
            style: "cancel",
          },
          {
            text: "Answer",
            onPress: () => call.answer(),
          },
        ],
        { cancelable: false },
      );
    },
  );

  const [extension, setExtension] = useState("+12762700060");
  return (
    <KeyboardAvoidingView className="flex-1 max-h-[700px]">
      <View className="flex-[0.5] justify-center">
        <Text className="type-h2 text-text text-center m-2.5">Call Agent</Text>
        <Text className="type-body text-text-muted text-center mb-1">
          Status: {connected ? "Connected" : "Not connected"}
        </Text>
      </View>
      <Middle
        client={client}
        call={call}
        extension={extension}
        setExtension={setExtension}
      />
    </KeyboardAvoidingView>
  );
};

export const Middle = ({
  call,
  extension,
  setExtension,
  client,
}: {
  call: any;
  extension: string;
  setExtension: (_: string) => void;
  client: Relay | null;
}) => {
  if (call) {
    return (
      <View className="flex-[2] flex-row justify-center items-center border-t border-border pr-2">
        {
          /*call?.localStream && (
          <RTCView
            mirror={false}
            objectFit="contain"
            stream={ call?.localStream }
            style={{width: '100%', height: '100%'}}
            zOrder={1}
          />)*/
          call?.localStream && <CallRTCView callStream={call?.localStream} />
        }
        {
          /*call?.remoteStream && (
          <RTCView
            mirror={false}
            objectFit="contain"
            stream={ call?.remoteStream }
            style={{width: '100%', height: '100%'}}
            zOrder={1}
          />)*/
          call?.remoteStream && <CallRTCView callStream={call?.remoteStream} />
        }
      </View>
    );
  } else {
    return (
      <>
        <View className="flex-[2] flex-row justify-center items-center border-t border-border pr-2">
          <Text className="pr-2 type-body text-text">Enter a number:</Text>
          <TextInput
            className="h-10 w-[180px] border border-border-strong rounded p-2 type-body text-text bg-surface"
            textAlign={"center"}
            onChangeText={(extension) => setExtension(extension)}
            value={extension}
          />
          {client && (
            <Bottom call={call} client={client} extension={extension} />
          )}
        </View>
        <AssetCall />
      </>
    );
  }
};

export const Bottom = ({
  client,
  call,
  extension,
}: {
  client: Relay;
  call: any;
  extension: string;
}) => {
  const [btnMicActive, setBtnMicActive] = useState(false);
  const [btnCamActive, setBtnCamActive] = useState(false);
  const [btnDeafActive, setBtnDeafActive] = useState(false);

  const [btnSpeakerActive, setBtnSpeakerActive] = useState(false);

  function makeCall() {
    // @ts-ignore
    client.newCall({
      destinationNumber: extension,
      video: { facingMode: "user" },
    });
  }

  function hangup() {
    call.hangup();
  }

  function toggleMic() {
    setBtnMicActive((i) => !i);
    call.toggleAudioMute();
  }

  function toggleCam() {
    setBtnCamActive((u) => !u);
    call.toggleVideoMute();
  }

  function toggleDeaf() {
    setBtnDeafActive((i) => !i);
    call.toggleDeaf();
  }

  function switchCamera() {
    call.switchCamera();
  }

  function toggleSpeaker() {
    setBtnSpeakerActive((i) => !i);
    setTimeout(() => {
      // only call on next render
      call.setSpeakerPhone(btnSpeakerActive);
    }, 0);
  }

  if (call) {
    return (
      <View className="flex-[0.5] p-2">
        <View className="flex-[0.5] flex-row justify-around items-center">
          <TouchableOpacity
            className="items-center justify-center rounded-full h-10 w-[120px]"
            onPress={toggleMic}
          >
            <Icon
              name="microphone"
              size={25}
              color={btnMicActive ? colors.text : colors.textMuted}
            />
            <Text className="text-center type-caption text-text">Mute</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="items-center justify-center rounded-full h-10 w-[120px]"
            onPress={toggleDeaf}
          >
            <Icon
              name="volume-mute"
              size={25}
              color={btnDeafActive ? colors.text : colors.textMuted}
            />
            <Text className="text-center type-caption text-text">Deaf</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="items-center justify-center rounded-full h-10 w-[120px]"
            onPress={toggleCam}
          >
            <Icon
              name="camera"
              size={25}
              color={btnCamActive ? colors.text : colors.textMuted}
            />
            <Text className="text-center type-caption text-text">Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="items-center justify-center rounded-full h-10 w-[120px]"
            onPress={switchCamera}
          >
            <Icon name="camera-retake" size={25} color={colors.text} />
            <Text className="text-center type-caption text-text">Flip Cam</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="items-center justify-center rounded-full h-10 w-[120px]"
            onPress={toggleSpeaker}
          >
            <Icon
              name="volume-high"
              size={25}
              color={btnSpeakerActive ? colors.text : colors.textMuted}
            />
            <Text className="text-center type-caption text-text">Speaker</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-[0.5] flex-row justify-around items-center">
          <TouchableOpacity
            className="items-center justify-center rounded-full h-10 w-[120px] bg-danger"
            onPress={hangup}
          >
            <Icon name="phone-hangup" size={25} color={colors.surface} />
          </TouchableOpacity>
        </View>
      </View>
    );
  } else {
    return (
      <View className="flex-[0.5] p-2">
        <TouchableOpacity
          className="items-center justify-center rounded-full h-10 w-[120px] bg-success"
          onPress={makeCall}
        >
          <Icon name="phone" size={25} color={colors.surface} />
        </TouchableOpacity>
      </View>
    );
  }
};
