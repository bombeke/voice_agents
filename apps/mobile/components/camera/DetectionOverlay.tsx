import { Detection } from "@/hooks/useTagDetection";
import { Canvas, matchFont, Rect, Text } from "@shopify/react-native-skia";
import { memo } from "react";
import { Dimensions, Platform } from "react-native";

/*interface Props {
  detections: Detection[] | Omit<ParameterType, "BasicParameterType">;
}*/

const { width, height } = Dimensions.get("window");

type Props = {
  detections?: Detection[];
  frameWidth: number;
  frameHeight: number;
};

export const DetectionOverlay = memo(
  ({ detections, frameWidth, frameHeight }: Props) => {
    const fontFamily = Platform.select({ ios: "Helvetica", default: "serif" });
    const fontStyle = {
      fontFamily,
      fontSize: 14,
      fontStyle: "italic",
      fontWeight: "bold",
    };
    const font = matchFont(fontStyle as any);

    if (!detections?.length) return null;

    const scaleX = width / frameWidth;
    const scaleY = height / frameHeight;

    return (
      <Canvas style={{ position: "absolute", width, height }}>
        {detections.map((d, i) => {
          const x = d.x1 * scaleX;
          const y = d.y1 * scaleY;
          const w = (d.x2 - d.x1) * scaleX;
          const h = (d.y2 - d.y1) * scaleY;

          return (
            <>
              <Rect
                key={`box-${i}`}
                x={x}
                y={y}
                width={w}
                height={h}
                color="lime"
                style="stroke"
                strokeWidth={3}
              />

              <Text
                key={`text-${i}`}
                x={x}
                y={y - 4}
                text={`${d.name} ${Math.round(d.score * 100)}%`}
                color="lime"   
                font={font}           
              />
            </>
          );
        })}
      </Canvas>
    );
  }
);