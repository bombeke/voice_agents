import { Detection } from "@/hooks/useTagDetection";
import { Canvas, Group, matchFont, Rect, Text } from "@shopify/react-native-skia";
import { memo, useMemo } from "react";
import { Dimensions, Platform } from "react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

type Props = {
  detections?: Detection[];
  frameWidth: number;
  frameHeight: number;
};

export const DetectionOverlay = memo(
  ({ detections, frameWidth, frameHeight }: Props) => {
    if (!detections?.length || !frameWidth || !frameHeight) {
      return null;
    }

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

    return (
      <Canvas
        style={{
          position: "absolute",
          width: screenWidth,
          height: screenHeight,
          pointerEvents: "none",
        }}
      >
        {detections.map((d, i) => {
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