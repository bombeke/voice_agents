import type { StyleProp, ViewStyle } from "react-native";

export type OnLoadEventPayload = {
  url: string;
};

export type TagsDetectorFrameProcessorModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
};

export type ChangeEventPayload = {
  value: string;
};

export type TagsDetectorFrameProcessorViewProps = {
  url: string;
  onLoad: (event: { nativeEvent: OnLoadEventPayload }) => void;
  style?: StyleProp<ViewStyle>;
};

export type BasicParameterType =
  | string
  | number
  | boolean
  | undefined
  | ArrayBuffer;
export type ParameterType =
  | BasicParameterType
  | BasicParameterType[]
  | Record<string, BasicParameterType | undefined>;
