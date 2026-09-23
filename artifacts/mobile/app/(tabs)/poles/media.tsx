import { PressableButton } from "@/components/PressableButton";
import { requestSavePermission } from "@/hooks/Helpers";
import { useIsForeground } from "@/hooks/useIsForeground";
import { StatusBarBlurBackground } from "@/views/StatusBarBlurBackground";
import IonIcon from "@expo/vector-icons/Ionicons";
import { useIsFocused } from "@react-navigation/core";
import { Asset } from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import type { ImageLoadEvent, NativeSyntheticEvent } from "react-native";
import { ActivityIndicator, Alert, Image, View } from "react-native";
import type { OnLoadData, OnVideoErrorData } from "react-native-video";
import RNVideo from "react-native-video";
import { withUniwind } from "uniwind";

const Video = withUniwind(RNVideo);
const Icon = withUniwind(IonIcon);
const ICON_CLASS = "text-shadow-black text-shadow-[0_0_1px]";

type OnLoadImage = NativeSyntheticEvent<ImageLoadEvent>;
const isVideoOnLoadEvent = (
  event: OnLoadData | OnLoadImage,
): event is OnLoadData => "duration" in event && "naturalSize" in event;

export default function MediaPage(): React.ReactElement {
  const { path, type } = useLocalSearchParams<{
    path?: string;
    type?: "photo" | "video";
  }>();
  const [hasMediaLoaded, setHasMediaLoaded] = useState(false);
  const isForeground = useIsForeground();
  const isScreenFocused = useIsFocused();
  const isVideoPaused = !isForeground || !isScreenFocused;
  const router = useRouter();
  const [savingState, setSavingState] = useState<"none" | "saving" | "saved">(
    "none",
  );

  const onMediaLoad = useCallback((event: OnLoadData | OnLoadImage) => {
    if (isVideoOnLoadEvent(event)) {
      console.log(
        `Video loaded. Size: ${event.naturalSize.width}x${event.naturalSize.height} (${event.naturalSize.orientation}, ${event.duration} seconds)`,
      );
    } else {
      const source = event.nativeEvent.source;
      console.log(`Image loaded. Size: ${source.width}x${source.height}`);
    }
  }, []);
  const onMediaLoadEnd = useCallback(() => {
    console.log("media has loaded.");
    setHasMediaLoaded(true);
  }, []);
  const onMediaLoadError = useCallback((error: OnVideoErrorData) => {
    console.error(`failed to load media: ${JSON.stringify(error)}`);
  }, []);

  const onSavePressed = useCallback(async () => {
    try {
      setSavingState("saving");

      const hasPermission = await requestSavePermission();
      if (!hasPermission) {
        Alert.alert(
          "Permission denied!",
          "Vision Camera does not have permission to save the media to your camera roll.",
        );
        return;
      }
      await Asset.create(`file:///${path}`);
      setSavingState("saved");
    } catch (e) {
      const message = e instanceof Error ? e.message : JSON.stringify(e);
      setSavingState("none");
      Alert.alert(
        "Failed to save!",
        `An unexpected error occured while trying to save your ${type}. ${message}`,
      );
    }
  }, [path, type]);

  const source = useMemo(() => ({ uri: `file://${path}` }), [path]);

  return (
    <View
      className={`flex-1 items-center justify-center bg-surface ${hasMediaLoaded ? "opacity-100" : "opacity-0"}`}
    >
      {type === "photo" && (
        <Image
          source={source}
          className="absolute inset-0"
          resizeMode="cover"
          onLoadEnd={onMediaLoadEnd}
          onLoad={onMediaLoad}
        />
      )}
      {type === "video" && (
        <Video
          source={source}
          className="absolute inset-0"
          paused={isVideoPaused}
          resizeMode="cover"
          posterResizeMode="cover"
          allowsExternalPlayback={false}
          automaticallyWaitsToMinimizeStalling={false}
          disableFocus={true}
          repeat={true}
          useTextureView={false}
          controls={false}
          playWhenInactive={true}
          ignoreSilentSwitch="ignore"
          onReadyForDisplay={onMediaLoadEnd}
          onLoad={onMediaLoad}
          onError={onMediaLoadError}
        />
      )}

      <PressableButton
        className="absolute top-safe-offset-[15px] left-safe-offset-[15px] w-10 h-10"
        onPress={router.back}
      >
        <Icon
          name="close"
          size={35}
          colorClassName="accent-white"
          className={ICON_CLASS}
        />
      </PressableButton>

      <PressableButton
        className="absolute bottom-safe-offset-[15px] left-safe-offset-[15px] w-10 h-10"
        onPress={onSavePressed}
        disabled={savingState !== "none"}
      >
        {savingState === "none" && (
          <Icon
            name="download"
            size={35}
            colorClassName="accent-white"
            className={ICON_CLASS}
          />
        )}
        {savingState === "saved" && (
          <Icon
            name="checkmark"
            size={35}
            colorClassName="accent-white"
            className={ICON_CLASS}
          />
        )}
        {savingState === "saving" && (
          <ActivityIndicator colorClassName="accent-white" />
        )}
      </PressableButton>

      <StatusBarBlurBackground />
    </View>
  );
}
