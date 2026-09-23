import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { TabBar } from "../TabBar";

const routes = [
  { key: "index-1", name: "index", params: undefined },
  { key: "records-1", name: "records", params: undefined },
  { key: "poles-1", name: "poles", params: undefined },
];

const descriptors = {
  "index-1": {
    options: { title: "Capture", tabBarIcon: () => <Text>icon</Text> },
  },
  "records-1": { options: { title: "Records", tabBarBadge: 3 } },
  // What expo-router sets for `href: null`.
  "poles-1": {
    options: { title: "Poles", tabBarItemStyle: { display: "none" } },
  },
};

const navigation = {
  emit: jest.fn(() => ({ defaultPrevented: false })),
  navigate: jest.fn(),
};

const renderBar = () =>
  render(
    <TabBar
      {...({
        state: { index: 0, routes },
        descriptors,
        navigation,
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      } as any)}
    />,
  );

beforeEach(() => jest.clearAllMocks());

describe("TabBar", () => {
  it("shows visible tabs with the focused one selected", async () => {
    await renderBar();
    expect(screen.getByRole("tab", { name: "Capture" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "Records" })).not.toBeSelected();
    expect(screen.queryByRole("tab", { name: "Poles" })).toBeNull();
  });

  it("shows the pending badge", async () => {
    await renderBar();
    expect(screen.getByText("3")).toBeOnTheScreen();
  });

  it("navigates to another tab", async () => {
    await renderBar();
    await fireEvent.press(screen.getByRole("tab", { name: "Records" }));
    expect(navigation.navigate).toHaveBeenCalledWith("records", undefined);
  });

  it("does not re-navigate to the focused tab", async () => {
    await renderBar();
    await fireEvent.press(screen.getByRole("tab", { name: "Capture" }));
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
