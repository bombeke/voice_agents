import { fakeDetectionEstimator } from "@/mocks/detections";
import { fakeNearbyAssetSource } from "@/mocks/tagging";
import { setDetectionEstimator } from "@/services/capture/AttributeEstimator";
import { setNearbyAssetSource } from "@/services/capture/NearbyAssets";
import {
  setSpeechToText,
  type SpeechToText,
} from "@/services/capture/SpeechToText";
import { captures, observations } from "@/db/schema";
import { seedCaptures, setupTestDatabase } from "@/db/testing/TestDb";
import { asc } from "drizzle-orm";
import {
  addPhoto,
  beginReview,
  beginTagging,
  captureSession$,
  editRecord,
  startSession,
} from "@/services/storage/CaptureSessionStore";
import type { CapturedPhoto } from "@/types/Capture";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { TaggingView } from "../TaggingView";

const mockRouter = { back: jest.fn(), push: jest.fn(), dismissTo: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

jest.mock("@/services/storage/ImageStore", () => ({
  ...jest.requireActual("@/services/storage/ImageStore"),
  persistCaptureImage: (uri?: string) => uri,
}));
jest.mock("@/hooks/Helpers", () => ({
  requestSavePermission: async () => true,
}));
jest.mock("expo-media-library", () => ({ createAssetAsync: jest.fn() }));
let mockUuid = 0;
// Zero-padded, so ids sort in the order they were made.
jest.mock("expo-crypto", () => ({
  randomUUID: () => `uuid-${String(++mockUuid).padStart(4, "0")}`,
}));

const photo: CapturedPhoto = {
  id: "photo-1",
  imageUri: "/tmp/1.jpg",
  capturedAt: Date.parse("2026-09-23T09:20:00Z"),
  heading: 142,
  detections: [],
  quality: { sharp: true, exposureOk: true },
};

const LOCATION = {
  latitude: 0.313612,
  longitude: 32.581104,
  accuracy: 2.8,
  altitude: 1203.4,
  satellites: 18,
  flags: [],
};

/** The mockup: two poles and a street light, the distant pole left undecided. */
function seed({ duplicate = true } = {}) {
  startSession("energy");
  addPhoto(photo, LOCATION);
  beginReview();
  if (duplicate) setNearbyAssetSource(fakeNearbyAssetSource);
  beginTagging();
}

type Record = { trackId: number; statuses: string[]; draft: boolean };
const getDb = setupTestDatabase();

/** The poles the save stored, in the order they were made. */
const savedRecords = async () =>
  (
    await getDb().orm.select().from(observations).orderBy(asc(observations.pid))
  ).map((r) => r.data as unknown as Record);

beforeEach(() => {
  jest.clearAllMocks();
  setDetectionEstimator(fakeDetectionEstimator);
});
afterEach(() => {
  setDetectionEstimator();
  setNearbyAssetSource();
  setSpeechToText();
});

describe("TaggingView", () => {
  it("opens as step 3 of 3 with the AI's suggestions and the stamped fix", async () => {
    seed();
    await render(<TaggingView />);
    expect(screen.getByRole("header", { name: "Tag this asset" })).toBeTruthy();
    expect(
      screen.getByText("Pole · concrete · 2 detections kept"),
    ).toBeTruthy();
    expect(screen.getByText("Step 3 of 3")).toBeTruthy();

    expect(
      screen.getByRole("radio", { name: "Energy & Power", checked: true }),
    ).toBeTruthy();
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(2);
    expect(
      screen.getByRole("checkbox", { name: "Inclined", checked: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", {
        name: "Covered by vegetation",
        checked: true,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: "Unknown", checked: true }),
    ).toBeTruthy();

    expect(
      screen.getByText(/A pole \(EP-00412\) was recorded 3\.2 m/),
    ).toBeTruthy();
    expect(screen.getByText("0.3136120")).toBeTruthy();
    expect(screen.getByText("±2.8 m · 18 sats")).toBeTruthy();
  });

  it("asks about the duplicate before saving, then saves and leaves", async () => {
    seed();
    await render(<TaggingView />);
    expect(screen.getByRole("button", { name: "Save record" })).toBeDisabled();
    expect(
      screen.getByText("Say whether this is the existing asset or a new one."),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByRole("radio", { name: "Update the existing asset" }),
    );
    await fireEvent.press(screen.getByRole("radio", { name: "Yes" }));
    await fireEvent.changeText(
      screen.getByLabelText("Comment"),
      "Leaning toward the road.",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Save record" }));

    await waitFor(() =>
      expect(mockRouter.dismissTo).toHaveBeenCalledWith("/(tabs)"),
    );
    const records = await savedRecords();
    expect(records.map((r) => r.trackId)).toEqual([-1, -3]);
    expect(records[0]).toMatchObject({
      statuses: ["inclined", "vegetation"],
      functional: "yes",
      comment: "Leaning toward the road.",
      linkedAssetId: "EP-00412",
      draft: false,
    });
    const [row] = await getDb().orm.select().from(captures);
    expect(row.summary).toMatchObject({ title: "Pole", flagged: false });
  });

  it("needs a status for a record but not for a draft", async () => {
    seed({ duplicate: false });
    await render(<TaggingView />);
    await fireEvent.press(screen.getByRole("checkbox", { name: "Inclined" }));
    await fireEvent.press(
      screen.getByRole("checkbox", { name: "Covered by vegetation" }),
    );
    expect(screen.getByRole("button", { name: "Save record" })).toBeDisabled();
    expect(
      screen.getByText("Pick at least one status to save the record."),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mockRouter.dismissTo).toHaveBeenCalled());
    expect((await savedRecords())[0]).toMatchObject({
      statuses: [],
      draft: true,
    });
    const [row] = await getDb().orm.select().from(captures);
    expect(row.flagged).toBe(true);
  });

  it("switches category to that category's statuses", async () => {
    seed();
    await render(<TaggingView />);
    await fireEvent.press(
      screen.getByRole("radio", { name: "Water & Sanitation" }),
    );
    expect(screen.getByRole("checkbox", { name: "Leaking" })).toBeTruthy();
    expect(
      screen.queryByRole("checkbox", { name: "Sagging lines" }),
    ).toBeNull();
    // Vegetation still applies; the lean isn't a water status.
    expect(
      screen.getByRole("checkbox", {
        name: "Covered by vegetation",
        checked: true,
      }),
    ).toBeTruthy();
    // The duplicate was an energy pole, so nothing blocks saving.
    expect(screen.queryByText(/Possible duplicate/)).toBeNull();
    expect(screen.getByRole("button", { name: "Save record" })).toBeEnabled();
  });

  it("dictates into the comment", async () => {
    const recogniser: SpeechToText = {
      isAvailable: () => true,
      start: async ({ onText, onEnd }) => {
        onText("Leaning after heavy rain.");
        onEnd();
        return { stop: jest.fn() };
      },
    };
    setSpeechToText(recogniser);
    seed();
    await render(<TaggingView />);
    await fireEvent.changeText(screen.getByLabelText("Comment"), "Pole A.");
    await fireEvent.press(
      screen.getByRole("button", { name: "Dictate comment" }),
    );
    expect(captureSession$.tagging.peek()?.comment).toBe(
      "Pole A. Leaning after heavy rain.",
    );
  });

  it("goes back to the review", async () => {
    seed();
    await render(<TaggingView />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Back to review" }),
    );
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("renders nothing to edit before the form is opened", async () => {
    startSession("energy");
    await render(<TaggingView />);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
  });

  it("edits a saved record and goes back to it", async () => {
    const record = {
      id: "r1",
      category: "energy" as const,
      title: "Concrete pole",
      capturedAt: "2026-09-22T10:14:00.000Z",
      photos: [],
      location: LOCATION,
      attributes: [],
      statuses: ["inclined" as const],
      suggestedStatuses: ["inclined" as const],
      functional: "unknown" as const,
      comment: "",
      poleIds: [],
    };
    await seedCaptures(
      getDb(),
      [
        {
          id: "r1",
          category: "energy",
          title: "Concrete pole",
          capturedAt: record.capturedAt,
          accuracyM: 2.8,
          syncStatus: "synced",
          flagged: false,
        },
      ],
      { records: { r1: record } },
    );
    editRecord(record);
    await render(<TaggingView />);

    expect(
      screen.getByRole("header", { name: "Edit record" }),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Step 3 of 3")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
    expect(screen.getByText("±2.8 m · 18 sats")).toBeOnTheScreen();

    await fireEvent.changeText(
      screen.getByLabelText("Comment"),
      "Leaning more",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    const [row] = await getDb().orm.select().from(captures);
    expect(row.record?.comment).toBe("Leaning more");
    expect(row.syncStatus).toBe("pending");
    expect(captureSession$.editingId.get()).toBeNull();
  });
});
