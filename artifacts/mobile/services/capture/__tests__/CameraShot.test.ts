import { read as readExif } from "@lodev09/react-native-exify";
import type {
  CameraDevice,
  CameraPhotoOutput,
} from "react-native-vision-camera";
import type { SensorCameraPose } from "@/types/Capture";
import { shootWithCamera } from "../CameraShot";

const LOCATION = {
  latitude: 0.3136,
  longitude: 32.5811,
  accuracy: 2.8,
  altitude: 1190,
  satellites: 18,
  flags: [],
};

const output = (orientation: string) =>
  ({
    capturePhoto: jest.fn(async () => ({
      width: 4000,
      height: 3000,
      orientation,
      saveToTemporaryFileAsync: async () => "/tmp/1.jpg",
    })),
  }) as unknown as CameraPhotoOutput;

const device = { focalLength: 26 } as CameraDevice;

const SENSOR: SensorCameraPose = {
  forward: [1, 0, 0],
  up: [0, 1, 0],
  headingDeg: 90,
  pitchDeg: 0,
  rollDeg: 0,
  trueNorth: true,
  timestamp: 1,
};

describe("shootWithCamera", () => {
  it("records the upright size and the lens from EXIF", async () => {
    jest.mocked(readExif).mockResolvedValueOnce({
      FocalLength: 5.1,
      FocalLengthIn35mmFilm: 24,
    });
    const photoOutput = output("right");
    const shot = await shootWithCamera({
      photoOutput,
      device,
      flash: true,
      detections: [],
      location: LOCATION,
      latest: null,
      heading: 142,
      sensor: null,
      inferenceMs: 31,
    });
    expect(photoOutput.capturePhoto).toHaveBeenCalledWith(
      { flashMode: "on" },
      {},
    );
    expect(readExif).toHaveBeenCalledWith("file:///tmp/1.jpg");
    expect(shot.path).toBe("/tmp/1.jpg");
    expect(shot.metadata).toMatchObject({
      engine: "camera",
      ar: null,
      cameraHeightM: null,
      intrinsics: {
        width: 3000,
        height: 4000,
        focalLengthMm: 5.1,
        // 24 mm equivalent over the 5000 px diagonal.
        focalLengthPx: expect.closeTo((24 * 5000) / Math.hypot(36, 24)),
      },
      device: { heading: 142, accuracy: 2.8 },
      detector: { inferenceMs: 31 },
    });
  });

  it("falls back to the camera's nominal focal length", async () => {
    const shot = await shootWithCamera({
      photoOutput: output("up"),
      device,
      flash: false,
      detections: [],
      location: LOCATION,
      latest: null,
      heading: null,
      sensor: null,
      inferenceMs: null,
    });
    expect(shot.metadata?.intrinsics).toMatchObject({
      width: 4000,
      height: 3000,
      focalLengthMm: null,
      focalLengthPx: expect.closeTo((26 * 5000) / Math.hypot(36, 24)),
    });
  });

  it("ranges each detection from the sensor attitude", async () => {
    const shot = await shootWithCamera({
      photoOutput: output("up"),
      device,
      flash: false,
      detections: [
        {
          trackId: 1,
          label: "culvert",
          confidence: 0.9,
          box: { xmin: 0.45, xmax: 0.55, ymin: 0.5, ymax: 0.7 },
        },
      ],
      location: LOCATION,
      latest: null,
      heading: 10,
      sensor: SENSOR,
      inferenceMs: null,
    });
    // The lens's bearing, not the compass's, goes on the photo.
    expect(shot.metadata).toMatchObject({
      sensor: SENSOR,
      device: { heading: 90, pitchDeg: 0, rollDeg: 0 },
    });
    expect(shot.detections[0].position).toMatchObject({
      source: "sensor",
      bearingDeg: expect.closeTo(90, 0),
    });
    expect(shot.detections[0].position!.longitude).toBeGreaterThan(
      LOCATION.longitude,
    );
  });

  it("keeps the phone's fix without an attitude", async () => {
    const detection = {
      trackId: 1,
      label: "culvert",
      confidence: 0.9,
      box: { xmin: 0.45, xmax: 0.55, ymin: 0.5, ymax: 0.7 },
    };
    const shot = await shootWithCamera({
      photoOutput: output("up"),
      device,
      flash: false,
      detections: [detection],
      location: LOCATION,
      latest: null,
      heading: null,
      sensor: null,
      inferenceMs: null,
    });
    expect(shot.detections).toEqual([detection]);
  });
});
