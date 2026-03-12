import { Canvas, Group, matchFont, Rect, Text } from "@shopify/react-native-skia";
import { memo, useMemo } from "react";
import { Dimensions, Platform } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

interface BoxProps {
  index: number;
  detections: any;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

type Props = {
  detections?: any;
};

export const DetectionOverlay = memo(
  ({ detections }: Props) => {

    const boxes = [];
    const isPortrait = screenHeight > screenWidth;

    /**
     * Memoized font (Skia fonts are expensive)
     */
    const font = useMemo(() => {
      const fontFamily = Platform.select({
        ios: "Helvetica",
        default: "serif",
      });

      return matchFont({
        fontFamily,
        fontSize: 14,
        fontStyle: "italic",
        fontWeight: "bold",
      } as any);
    }, []);

    /**
     * Calculate scaling + offsets for VisionCamera "cover" mode
     */
    const frameHeight = detections.value.frameHeight || 0
    const frameWidth = detections.value.frameWidth || 0

    const { scale, offsetX, offsetY } = useMemo(() => {
      let scale: number;
      let offsetX: number;
      let offsetY: number;

      if (isPortrait) {
        scale = Math.max(screenWidth / frameHeight, screenHeight / frameWidth);
        offsetX = (screenWidth - frameHeight * scale) / 2;
        offsetY = (screenHeight - frameWidth * scale) / 2;
      } else {
        scale = Math.max(screenWidth / frameWidth, screenHeight / frameHeight);
        offsetX = (screenWidth - frameWidth * scale) / 2;
        offsetY = (screenHeight - frameHeight * scale) / 2;
      }

      return { scale, offsetX, offsetY };
    }, [frameWidth, frameHeight, isPortrait]);
  

    for (let i = 0; i < 80; i++) {
      boxes.push(<DetectionBox key={i} index={i} detections={detections} />);
    }
    if (!detections?.value?.detections?.length || !frameWidth || !frameHeight) {
      return null;
    }
    return (
      <Canvas
        style={{
          position: "absolute",
          width: screenWidth,
          height: screenHeight,
          pointerEvents: "none",
        }}
      >
        {detections.value?.detections?.map((d: any, i:number) => {
          let x: number;
          let y: number;
          let w: number;
          let h: number;
          const color =
            d.score > 0.8 ? "lime" :
            d.score > 0.5 ? "yellow" :
            "red"
          /**
           * Android camera sensor rotation fix
           * VisionCamera frames are rotated 90°
           */
          if (Platform.OS === "android" && isPortrait) {
            x = (frameHeight - d.y2) * scale + offsetX;
            y = d.x1 * scale + offsetY;
            w = (d.y2 - d.y1) * scale;
            h = (d.x2 - d.x1) * scale;
          } else {
            x = d.x1 * scale + offsetX;
            y = d.y1 * scale + offsetY;
            w = (d.x2 - d.x1) * scale;
            h = (d.y2 - d.y1) * scale;
          }

          /**
           * Skip invalid boxes
           */
          if (w <= 0 || h <= 0) return null;

          const label = `${d.name ?? "object"} ${Math.round(d.score * 100)}%`;

          return (
            <Group key={`detection-${i}`}>
              {/* Bounding Box */}
              <Rect
                x={x}
                y={y}
                width={w}
                height={h}
                color={color}
                style="stroke"
                strokeWidth={3}
              />

              {/* Detection Label */}
              {font && (
                <Text
                  x={x}
                  y={y - 8}
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
  }
);



export const DetectionBox = ({ index, detections }: BoxProps) => {
  const style = useAnimatedStyle(() => {
    const data = detections.value?.detections;

    if (!data || index >= data.length) {
      return { opacity: 0 };
    }

    const d = data[index];

    return {
      position: "absolute",
      left: d.x,
      top: d.y,
      width: d.width,
      height: d.height,
      borderWidth: 2,
      borderColor: "lime",
      opacity: 1,
    };
  });

  return <Animated.View style={style} />;
};