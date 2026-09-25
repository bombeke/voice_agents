import { ArCameraViewport } from "@/components/camera/ArCameraViewport";
import { CameraViewport } from "@/components/camera/CameraViewport";
import { CaptureStatusStrip } from "@/components/camera/CaptureStatusStrip";
import { CaptureTopBar } from "@/components/camera/CaptureTopBar";
import {
  CaptureTray,
  type SheetPosition,
} from "@/components/camera/CaptureTray";
import { PermissionsPage } from "@/components/camera/PermissionsPage";
import { InfoNote } from "@/components/ui/InfoNote";
import { DRAFT_OFFER_AFTER_MS } from "@/constants/Capture";
import { DETECTOR_MODEL_NAME } from "@/constants/DetectorModel";
import { strings } from "@/constants/Strings";
import { locationFrom } from "@/helpers/captureSession";
import { formatLabel } from "@/helpers/detectionReview";
import { fill } from "@/helpers/format";
import {
  MANUAL_TRACK_ID,
  targetPosition,
  useArCapture,
} from "@/hooks/useArCapture";
import { useArSupport } from "@/hooks/useArSupport";
import { useCaptureAccuracyGate } from "@/hooks/useCaptureAccuracyGate";
import { useCaptureSession } from "@/hooks/useCaptureSession";
import { useDeviceAttitude } from "@/hooks/useDeviceAttitude";
import { useIsForeground } from "@/hooks/useIsForeground";
import {
  useLiveDetection,
  type DetectorStatus,
} from "@/hooks/useLiveDetection";
import { useSensorRanging } from "@/hooks/useSensorRanging";
import { currentPose } from "@/services/capture/ArBridge";
import { shootWithCamera } from "@/services/capture/CameraShot";
import { Routes } from "@/services/Routes";
import {
  beginReview,
  resetSession,
  startSession,
} from "@/services/storage/CaptureSessionStore";
import { isOnline$ } from "@/services/storage/NetworkState";
import type { CaptureCategory, CaptureLocation } from "@/types/Capture";
import { useSelector } from "@legendapp/state/react";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import {
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from "react-native-vision-camera";

/** How long "no ground found there" stays up after a failed tap. */
const PLACE_FAILED_MS = 3000;

/**
 * Full-screen capture, step 1 of 3 (design/screens/Camera.png): live
 * detections, the < 4 m GPS gate and up to three photos. On ARCore/ARKit
 * devices the AR view is the camera and each asset is ranged and placed at
 * its own position; elsewhere VisionCamera captures and the phone's tilt and
 * compass range each asset (see sensorGeometry).
 * Continue opens the detection review; nothing is stored until tagging is
 * saved.
 */
export function CaptureView({ category }: { category: CaptureCategory }) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const support = useArSupport();

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // Each opening of the camera starts an empty session.
  useEffect(() => {
    startSession(category);
  }, [category]);

  if (!hasPermission) return <PermissionsPage onAllow={requestPermission} />;
  if (support === "checking") return <View className="flex-1 bg-camera" />;
  return support === "supported" ? (
    <ArCaptureView category={category} />
  ) : (
    <CameraCaptureView category={category} />
  );
}

/** What both camera engines share: gate, session, draft and navigation. */
function useCaptureFrame(hasCamera: boolean) {
  const router = useRouter();
  const isForeground = useIsForeground();
  const isFocused = useIsFocused();
  const gate = useCaptureAccuracyGate(hasCamera);
  const session = useCaptureSession();
  const online = useSelector(isOnline$);
  const [draft, setDraft] = useState(false);
  const offerDraft = useDraftOffer(gate.isReady, gate.startedAt);

  const close = useCallback(() => {
    resetSession();
    if (router.canGoBack()) router.back();
    else router.replace(Routes.HOME);
  }, [router]);

  const review = useCallback(() => {
    beginReview();
    router.push(Routes.CAPTURE_REVIEW);
  }, [router]);

  /** The fix stamped on the shots: the session's, else the gate's. */
  const location: CaptureLocation | null =
    session.location ?? locationFrom(gate.averaged, gate.latest, !gate.isReady);

  return {
    gate,
    session,
    online,
    draft,
    offerDraft,
    saveDraft: () => setDraft(true),
    // Paused while the review screen is on top.
    cameraActive: isForeground && isFocused,
    location,
    close,
    review,
  };
}

type CaptureFrame = ReturnType<typeof useCaptureFrame>;

function devicePosition(
  location: CaptureLocation | null,
): SheetPosition | null {
  return location
    ? { ...location, accuracy: location.accuracy, isAsset: false }
    : null;
}

/** AR-first capture: the asset is ranged and gets its own coordinates. */
function ArCaptureView({ category }: { category: CaptureCategory }) {
  const frame = useCaptureFrame(true);
  const { gate, session, location } = frame;
  const ar = useArCapture(category, frame.cameraActive);
  const [placeFailed, setPlaceFailed] = useState(false);

  useEffect(() => {
    if (!placeFailed) return;
    const timer = setTimeout(() => setPlaceFailed(false), PLACE_FAILED_MS);
    return () => clearTimeout(timer);
  }, [placeFailed]);

  // Nothing is logged until ARCore has mapped the ground (drift guard); a
  // flagged draft can still be saved without it.
  const tracked = ar.tracking === "normal";
  const canCapture = (gate.isReady && tracked) || frame.draft;

  const pose = currentPose(ar.bridge);
  const asset = targetPosition(ar.target, pose, location, gate.heading);
  const position: SheetPosition | null = asset
    ? { ...asset, accuracy: asset.accuracyM, isAsset: true }
    : devicePosition(location);

  const targetLabel =
    ar.target && ar.target.trackId !== MANUAL_TRACK_ID
      ? ar.trackLabels.find((t) => t.trackId === ar.target!.trackId)?.label
      : undefined;
  const s = strings.capture.sheet;
  const note = placeFailed
    ? s.placeFailed
    : ar.placing
      ? s.placeHint
      : !tracked
        ? s.mapGround
        : ar.target
          ? fill(s.assetAt, {
              label: formatLabel(targetLabel ?? "asset"),
              distance: ar.target.distanceM.toFixed(1),
            })
          : ar.status === "ready"
            ? s.noTarget
            : null;

  const capture = useCallback(() => {
    if (!location) return;
    session.takePhoto({
      shoot: () =>
        ar.shoot({ location, latest: gate.latest, heading: gate.heading }),
      location,
      heading: gate.heading,
    });
  }, [session, ar, location, gate.latest, gate.heading]);

  return (
    <CaptureLayout
      frame={frame}
      category={category}
      viewport={
        <ArCameraViewport
          ar={ar}
          isActive={frame.cameraActive}
          onPlaceFailed={() => setPlaceFailed(true)}
        />
      }
      tracking={ar.tracking}
      rangeM={ar.target?.distanceM ?? null}
      detector={{
        status: ar.status,
        progress: ar.downloadProgress,
        inferenceMs: ar.inferenceMs,
      }}
      tray={{
        canCapture,
        lockedLabel: gate.isReady
          ? strings.capture.shutterLockedAr
          : strings.capture.shutterLocked,
        position,
        note,
        placeByTap: {
          active: ar.placing,
          onPress: () => ar.setPlacing(!ar.placing),
        },
        onCapture: capture,
      }}
    />
  );
}

/**
 * Devices without AR: VisionCamera. The accelerometer and magnetometer give
 * the lens attitude, which ranges the best track live and every detection at
 * the shutter; without them the record takes the phone's fix.
 */
function CameraCaptureView({ category }: { category: CaptureCategory }) {
  const device = useCameraDevice("back");
  const photoOutput = usePhotoOutput();
  const frame = useCaptureFrame(true);
  const { gate, session, location } = frame;
  const [flash, setFlash] = useState(false);
  const detection = useLiveDetection(category, frame.cameraActive);
  const attitude = useDeviceAttitude(frame.cameraActive, gate.declination);
  const target = useSensorRanging({
    enabled: frame.cameraActive,
    attitude,
    snapshot: detection.snapshot,
    frameSize: detection.frameSize,
    focal35mm: device?.focalLength ?? null,
    location,
  });
  const canCapture = gate.isReady || frame.draft;

  const position: SheetPosition | null = target
    ? {
        ...target.position,
        accuracy: target.position.accuracyM,
        isAsset: true,
      }
    : devicePosition(location);
  const note = target
    ? fill(strings.capture.sheet.assetAtSensor, {
        label: formatLabel(target.label),
        distance: target.position.distanceM.toFixed(1),
      })
    : null;

  const capture = useCallback(() => {
    if (!location || !device) return;
    // The attitude when the button was pressed, not after the shutter lag.
    const sensor = attitude.read();
    const heading = sensor?.headingDeg ?? gate.heading;
    session.takePhoto({
      shoot: () =>
        shootWithCamera({
          photoOutput,
          device,
          flash,
          detections: detection.snapshot(),
          location,
          latest: gate.latest,
          heading,
          sensor,
          inferenceMs: detection.inferenceMs,
        }),
      location,
      heading,
    });
  }, [
    session,
    gate,
    photoOutput,
    device,
    flash,
    detection,
    location,
    attitude,
  ]);

  if (!device) {
    return (
      <View className="flex-1 justify-center p-6 bg-background">
        <InfoNote>{strings.capture.noCamera}</InfoNote>
      </View>
    );
  }

  return (
    <CaptureLayout
      frame={frame}
      category={category}
      flash={flash}
      onToggleFlash={() => setFlash((on) => !on)}
      viewport={
        <CameraViewport
          device={device}
          isActive={frame.cameraActive}
          detection={detection}
          photoOutput={photoOutput}
          category={category}
          locked={canCapture}
        />
      }
      tracking={null}
      rangeM={target?.position.distanceM ?? null}
      detector={{
        status: detection.status,
        progress: detection.downloadProgress,
        inferenceMs: detection.inferenceMs,
      }}
      tray={{
        canCapture,
        position,
        note,
        placeByTap: null,
        onCapture: capture,
      }}
    />
  );
}

interface CaptureLayoutProps {
  frame: CaptureFrame;
  category: CaptureCategory;
  flash?: boolean;
  onToggleFlash?: () => void;
  viewport: ReactNode;
  tracking: Parameters<typeof CaptureStatusStrip>[0]["tracking"];
  rangeM: number | null;
  detector: {
    status: DetectorStatus;
    progress: number;
    inferenceMs: number | null;
  };
  tray: Pick<
    Parameters<typeof CaptureTray>[0],
    | "canCapture"
    | "lockedLabel"
    | "position"
    | "note"
    | "placeByTap"
    | "onCapture"
  >;
}

function CaptureLayout({
  frame,
  category,
  flash = false,
  onToggleFlash,
  viewport,
  tracking,
  rangeM,
  detector,
  tray,
}: CaptureLayoutProps) {
  const { gate, session } = frame;
  return (
    <View className="flex-1 bg-camera">
      {viewport}

      <View className="gap-3" pointerEvents="box-none">
        <CaptureTopBar
          category={category}
          flash={flash}
          onClose={frame.close}
          onToggleFlash={onToggleFlash}
        />
        <CaptureStatusStrip
          status={gate.status}
          accuracy={gate.accuracy}
          latest={gate.latest}
          heading={gate.heading}
          error={gate.error}
          tracking={tracking}
          rangeM={rangeM}
          model={DETECTOR_MODEL_NAME}
          inferenceMs={
            detector.status === "ready" ? detector.inferenceMs : null
          }
        />
        <ModelNote status={detector.status} progress={detector.progress} />
      </View>

      <View className="absolute left-0 right-0 bottom-0">
        <CaptureTray
          {...tray}
          photos={session.photos}
          isCapturing={session.isCapturing}
          offerDraft={frame.offerDraft}
          online={frame.online}
          onRetake={session.removePhoto}
          onContinue={frame.review}
          onSaveDraft={frame.saveDraft}
        />
      </View>
    </View>
  );
}

/** True once the gate has been waiting DRAFT_OFFER_AFTER_MS without locking. */
function useDraftOffer(isReady: boolean, startedAt: number): boolean {
  const [offer, setOffer] = useState(false);
  useEffect(() => {
    if (isReady) {
      setOffer(false);
      return;
    }
    const wait = Math.max(0, startedAt + DRAFT_OFFER_AFTER_MS - Date.now());
    const timer = setTimeout(() => setOffer(true), wait);
    return () => clearTimeout(timer);
  }, [isReady, startedAt]);
  return offer;
}

function ModelNote({
  status,
  progress,
}: {
  status: DetectorStatus;
  progress: number;
}) {
  if (status === "ready") return null;
  const text =
    status === "loading"
      ? fill(strings.capture.model.loading, { percent: Math.round(progress) })
      : strings.capture.model.unavailable;
  return (
    <View className="mx-3 self-center px-3.5 py-2 rounded-[18px] bg-camera/80">
      <Text
        accessibilityLiveRegion="polite"
        className="type-caption text-on-camera-muted text-center"
      >
        {text}
      </Text>
    </View>
  );
}
