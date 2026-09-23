import { AccuracyCard } from "@/components/camera/AccuracyCard";
import { CameraViewport } from "@/components/camera/CameraViewport";
import { CaptureTopBar } from "@/components/camera/CaptureTopBar";
import { CaptureTray } from "@/components/camera/CaptureTray";
import { PermissionsPage } from "@/components/camera/PermissionsPage";
import { InfoNote } from "@/components/ui/InfoNote";
import { DRAFT_OFFER_AFTER_MS } from "@/constants/Capture";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import { locationFrom } from "@/helpers/captureSession";
import { useCaptureAccuracyGate } from "@/hooks/useCaptureAccuracyGate";
import { useCaptureSession } from "@/hooks/useCaptureSession";
import { useIsForeground } from "@/hooks/useIsForeground";
import {
  useLiveDetection,
  type DetectorStatus,
} from "@/hooks/useLiveDetection";
import { Routes } from "@/services/Routes";
import {
  beginReview,
  resetSession,
  startSession,
} from "@/services/storage/CaptureSessionStore";
import type { CaptureCategory } from "@/types/Capture";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import {
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from "react-native-vision-camera";

/**
 * Full-screen capture, step 1 of 3 (design screen 4): live preview with
 * tracked detections, the < 4 m GPS gate and up to three photos. Continue
 * opens the detection review; nothing is stored until tagging is saved.
 */
export function CaptureView({ category }: { category: CaptureCategory }) {
  const router = useRouter();
  const isForeground = useIsForeground();
  const isFocused = useIsFocused();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const photoOutput = usePhotoOutput();

  const gate = useCaptureAccuracyGate(hasPermission);
  const session = useCaptureSession();
  const [flash, setFlash] = useState(false);
  const [draft, setDraft] = useState(false);
  const offerDraft = useDraftOffer(gate.isReady, gate.startedAt);

  // Paused while the review screen is on top.
  const cameraActive = isForeground && isFocused;
  const detection = useLiveDetection(category, cameraActive);
  const canCapture = gate.isReady || draft;

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // Each opening of the camera starts an empty session.
  useEffect(() => {
    startSession(category);
  }, [category]);

  const close = useCallback(() => {
    resetSession();
    if (router.canGoBack()) router.back();
    else router.replace(Routes.HOME);
  }, [router]);

  const review = useCallback(() => {
    beginReview();
    router.push(Routes.CAPTURE_REVIEW);
  }, [router]);

  const capture = useCallback(() => {
    const location =
      session.location ??
      locationFrom(gate.averaged, gate.latest, !gate.isReady);
    if (!location) return;
    session.takePhoto({
      photoOutput,
      flash,
      location,
      heading: gate.heading,
      detections: detection.snapshot(),
    });
  }, [session, gate, photoOutput, flash, detection]);

  if (!hasPermission) return <PermissionsPage onAllow={requestPermission} />;

  if (!device) {
    return (
      <View className="flex-1 justify-center p-6 bg-background">
        <InfoNote>{strings.capture.noCamera}</InfoNote>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-camera">
      <CameraViewport
        device={device}
        isActive={cameraActive}
        detection={detection}
        photoOutput={photoOutput}
        category={category}
        locked={canCapture}
      />

      <View className="gap-3" pointerEvents="box-none">
        <CaptureTopBar
          category={category}
          flash={flash}
          onClose={close}
          onToggleFlash={() => setFlash((on) => !on)}
        />
        <AccuracyCard
          status={gate.status}
          accuracy={gate.accuracy}
          streak={gate.streak}
          latest={gate.latest}
          heading={gate.heading}
          error={gate.error}
        />
        <ModelNote
          status={detection.status}
          progress={detection.downloadProgress}
        />
      </View>

      <View className="absolute left-0 right-0 bottom-0">
        <CaptureTray
          photos={session.photos}
          canCapture={canCapture}
          isCapturing={session.isCapturing}
          offerDraft={offerDraft}
          onCapture={capture}
          onRetake={session.removePhoto}
          onContinue={review}
          onSaveDraft={() => setDraft(true)}
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
