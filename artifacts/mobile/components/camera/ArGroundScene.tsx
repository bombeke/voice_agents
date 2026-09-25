import { colors } from "@/constants/theme";
import { trackingStateFrom } from "@/helpers/arGeometry";
import type { ArBridge, ArNavigator } from "@/services/capture/ArBridge";
import type { Vec3 } from "@/types/Capture";
import { useSelector } from "@legendapp/state/react";
import {
  ViroARScene,
  ViroMaterials,
  ViroPolyline,
} from "@reactvision/react-viro";

ViroMaterials.createMaterials({
  groundRing: { diffuseColor: colors.gpsLocked, lightingModel: "Constant" },
});

/** A 0.35 m ring on the ground, drawn around the asset's base. */
const RING: Vec3[] = Array.from({ length: 33 }, (_, i) => {
  const a = (i / 32) * Math.PI * 2;
  return [Math.cos(a) * 0.35, 0.01, Math.sin(a) * 0.35];
});

export interface ArGroundSceneProps {
  arSceneNavigator: ArNavigator & { viroAppProps: { bridge: ArBridge } };
}

/**
 * The AR scene: ARCore/ARKit tracking of horizontal planes, the camera pose
 * every frame (sensor-fused, drift filtered) and the ground ring under the
 * tracked asset. Everything else is drawn by React Native over the view.
 */
export function ArGroundScene({ arSceneNavigator }: ArGroundSceneProps) {
  const { bridge } = arSceneNavigator.viroAppProps;
  const marker = useSelector(bridge.marker$);
  return (
    <ViroARScene
      ref={(scene) => {
        bridge.scene = scene;
        bridge.navigator = scene ? arSceneNavigator : null;
        if (!scene) {
          // The session ends with the scene; the next one starts unmapped.
          bridge.pose = null;
          bridge.tracking$.set("unavailable");
        }
      }}
      anchorDetectionTypes={["PlanesHorizontal"]}
      onTrackingUpdated={(state) =>
        bridge.tracking$.set(trackingStateFrom(Number(state)))
      }
      onCameraTransformUpdate={({ position, rotation, forward, up }) => {
        bridge.pose = {
          position: [...position] as Vec3,
          rotation: [...rotation] as Vec3,
          forward: [...forward] as Vec3,
          up: [...up] as Vec3,
          timestamp: Date.now(),
        };
      }}
    >
      {marker ? (
        <ViroPolyline
          position={marker}
          points={RING}
          thickness={0.02}
          materials={["groundRing"]}
        />
      ) : null}
    </ViroARScene>
  );
}
