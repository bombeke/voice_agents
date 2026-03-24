import { Canvas, Group, matchFont, Rect, Text } from "@shopify/react-native-skia";
import { memo, useMemo } from "react";
import { Dimensions, Platform, StyleSheet } from "react-native";
import { useDerivedValue } from "react-native-reanimated";


interface BoxProps {
  index: number;
  detections: any;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

type Props = {
  detections?: any;
};

export const DetectionOverlay1 = memo(({ detections }: Props) => {
  const isPortrait = screenHeight > screenWidth;
  console.log("detections0:", detections.value);
  const font = useMemo(() => {
    return matchFont({
      fontFamily: Platform.OS === "ios" ? "Helvetica" : "serif",
      fontSize: 14,
      fontStyle: "italic",
      fontWeight: "bold",
    } as any);
  }, []);
  console.log("detections1:", detections.value);
  const dets = detections.value?.detections ?? [];

  if (dets.length === 0) return null;

  return (
    <Canvas
      style={{
        position: "absolute",
        width: screenWidth,
        height: screenHeight,
        pointerEvents: "none",
      }}
    >
      <Rect x={100} y={100} width={200} height={200} color="lime" style="stroke" strokeWidth={4} />
      {dets.map((_: any, i: number) => {
        /**
         * Each box is reactive
         */
        console.log("detected0")
        const x = useDerivedValue(() => {
          console.log("detected1")
          const d = detections.value?.detections?.[i];
          const fw = detections.value?.frameWidth;
          const fh = detections.value?.frameHeight;

          if (!d || !fw || !fh) return 0;

          let scale, offsetX;

          if (isPortrait) {
            scale = Math.max(screenWidth / fh, screenHeight / fw);
            offsetX = (screenWidth - fh * scale) / 2;
          } else {
            scale = Math.max(screenWidth / fw, screenHeight / fh);
            offsetX = (screenWidth - fw * scale) / 2;
          }

          if (Platform.OS === "android" && isPortrait) {
            return (fh - d.y2) * scale + offsetX;
          }

          return d.x1 * scale + offsetX;
        });
        console.log("detected2")

        const y = useDerivedValue(() => {
          const d = detections.value?.detections?.[i];
          const fw = detections.value?.frameWidth;
          const fh = detections.value?.frameHeight;

          if (!d || !fw || !fh) return 0;

          let scale, offsetY;

          if (isPortrait) {
            scale = Math.max(screenWidth / fh, screenHeight / fw);
            offsetY = (screenHeight - fw * scale) / 2;
          } else {
            scale = Math.max(screenWidth / fw, screenHeight / fh);
            offsetY = (screenHeight - fh * scale) / 2;
          }

          if (Platform.OS === "android" && isPortrait) {
            return d.x1 * scale + offsetY;
          }

          return d.y1 * scale + offsetY;
        });

        const width = useDerivedValue(() => {
          const d = detections.value?.detections?.[i];
          const fw = detections.value?.frameWidth;
          const fh = detections.value?.frameHeight;

          if (!d || !fw || !fh) return 0;

          const scale = isPortrait
            ? Math.max(screenWidth / fh, screenHeight / fw)
            : Math.max(screenWidth / fw, screenHeight / fh);

          return Platform.OS === "android" && isPortrait
            ? (d.y2 - d.y1) * scale
            : (d.x2 - d.x1) * scale;
        });

        const height = useDerivedValue(() => {
          const d = detections.value?.detections?.[i];
          const fw = detections.value?.frameWidth;
          const fh = detections.value?.frameHeight;

          if (!d || !fw || !fh) return 0;

          const scale = isPortrait
            ? Math.max(screenWidth / fh, screenHeight / fw)
            : Math.max(screenWidth / fw, screenHeight / fh);

          return Platform.OS === "android" && isPortrait
            ? (d.x2 - d.x1) * scale
            : (d.y2 - d.y1) * scale;
        });

        const color = useDerivedValue(() => {
          const d = detections.value?.detections?.[i];
          if (!d) return "transparent";

          return d.score > 0.8
            ? "lime"
            : d.score > 0.5
            ? "yellow"
            : "red";
        });

        const label = useDerivedValue(() => {
          const d = detections.value?.detections?.[i];
          if (!d) return "";

          return `${d.name ?? "object"} ${Math.round(d.score * 100)}%`;
        });

        return (
          <Group key={i}>
            <Rect
              x={x}
              y={y}
              width={width}
              height={height}
              color={color}
              style="stroke"
              strokeWidth={3}
            />
            {font && (
              <Text
                x={x}
                y={y}
                text={label}
                color="red"
                font={font}
              />
            )}
          </Group>
        );
      })}
    </Canvas>
  );
});


export const DetectionOverlay = ({ detections }: Props) => {
  console.log("detections:",detections)
  if (!detections) return null;

  return (
    <Canvas style={[StyleSheet.absoluteFill,{zIndex: 1000}]}>
      {detections.detections.map((d:any, i:number) => (
        <Rect
          key={i}
          x={d.x1}
          y={d.y1}
          width={d.width}
          height={d.height}
          color="red"
          style="stroke"
          strokeWidth={3}
        />
      ))}
    </Canvas>
  );
};