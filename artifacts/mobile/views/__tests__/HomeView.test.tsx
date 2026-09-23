import {
  clearCaptures,
  gnssStatus$,
  replaceCaptures,
} from "@/services/storage/CaptureStore";
import type { CaptureSummary } from "@/types/Capture";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { HomeView } from "../HomeView";

const mockRouter = { push: jest.fn(), navigate: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ org: "Pilot Zone 3" }),
}));

const today = (hour: number, minute = 0) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const CAPTURES: CaptureSummary[] = [
  {
    id: "a",
    category: "energy",
    title: "Concrete pole · inclined 7°",
    capturedAt: today(0, 14),
    accuracyM: 2.8,
    syncStatus: "pending",
    flagged: false,
  },
  {
    id: "b",
    category: "roads",
    title: "Pothole · 1.2 m wide",
    capturedAt: today(0, 5),
    accuracyM: 2.9,
    syncStatus: "synced",
    flagged: true,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  replaceCaptures(CAPTURES);
  gnssStatus$.set({ bands: "L1+L5", ok: true });
});

describe("HomeView", () => {
  it("renders the stats, categories and last capture from the store", async () => {
    await render(<HomeView />);

    expect(screen.getByText("IIP · Pilot Zone 3")).toBeOnTheScreen();
    expect(screen.getByText("1 pending")).toBeOnTheScreen();
    expect(screen.getByLabelText("Captured today: 2")).toBeOnTheScreen();
    expect(screen.getByLabelText("Synced: 1")).toBeOnTheScreen();
    expect(screen.getByLabelText("Flagged: 1")).toBeOnTheScreen();
    expect(
      screen.getByRole("header", { name: "What are you capturing?" }),
    ).toBeOnTheScreen();
    for (const name of [
      "Energy & Power",
      "Water & Sanitation",
      "Telecom",
      "Roads & Drainage",
    ]) {
      expect(screen.getByRole("button", { name })).toBeOnTheScreen();
    }
    expect(
      screen.getByRole("button", { name: /Concrete pole · inclined 7°/ }),
    ).toBeOnTheScreen();
  });

  it("starts a capture for the chosen category", async () => {
    await render(<HomeView />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Water & Sanitation" }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/capture",
      params: { category: "water" },
    });
  });

  it("lets the AI pick the category", async () => {
    await render(<HomeView />);
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Not sure? Let AI pick the category",
      }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/capture",
      params: { category: "auto" },
    });
  });

  it("opens records from the sync pill and profile from the avatar", async () => {
    await render(<HomeView />);
    await fireEvent.press(
      screen.getByRole("button", { name: /records waiting to sync/ }),
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith("/(tabs)/records");
    await fireEvent.press(
      screen.getByRole("button", { name: "Profile and settings" }),
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith("/(tabs)/settings");
  });

  it("shows an empty state before the first capture", async () => {
    clearCaptures();
    await render(<HomeView />);
    expect(screen.getByLabelText("Captured today: 0")).toBeOnTheScreen();
    expect(screen.queryByText(/pending/)).toBeNull();
    expect(screen.getByText(/Nothing captured yet/)).toBeOnTheScreen();
  });
});
