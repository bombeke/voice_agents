import type { CapturedPhoto } from "@/types/Capture";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { CaptureTagForm } from "../CaptureTagForm";

jest.mock("@react-native-picker/picker", () => {
  const { Text, View } = jest.requireActual("react-native");
  function Picker({ onValueChange, children, accessibilityLabel }: any) {
    return (
      <View accessibilityLabel={accessibilityLabel}>
        {children}
        <Text
          accessibilityRole="button"
          onPress={() => onValueChange("damaged")}
        >
          pick damaged
        </Text>
      </View>
    );
  }
  Picker.Item = function PickerItem({ label }: { label: string }) {
    return <Text>{label}</Text>;
  };
  return { Picker };
});

const photo: CapturedPhoto = {
  imageUri: "/tmp/1.jpg",
  capturedAt: 0,
  heading: null,
  detections: [],
  quality: { sharp: null, exposureOk: null },
};

const props = {
  visible: true,
  photos: [photo],
  location: {
    latitude: 0.3476123,
    longitude: 32.5825456,
    accuracy: 2.8,
    flags: [],
  },
  detectedCount: 2,
  isSaving: false,
  onSubmit: jest.fn(),
  onBack: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe("CaptureTagForm", () => {
  it("summarises the capture and saves the chosen status and comment", async () => {
    await render(<CaptureTagForm {...props} category="energy" />);
    expect(screen.getByText("2 assets detected")).toBeTruthy();
    expect(screen.getByText("0.3476123, 32.5825456")).toBeTruthy();
    expect(screen.getByText("GPS ±2.8 m")).toBeTruthy();

    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await fireEvent.press(screen.getByRole("button", { name: "pick damaged" }));
    await fireEvent.changeText(
      screen.getByLabelText("Comment"),
      "  leaning 7°  ",
    );
    await fireEvent.press(save);
    expect(props.onSubmit).toHaveBeenCalledWith({
      category: "energy",
      tag: "damaged",
      comment: "leaning 7°",
    });
  });

  it("makes the surveyor pick a category when the AI chose", async () => {
    await render(<CaptureTagForm {...props} category="auto" />);
    await fireEvent.press(screen.getByRole("button", { name: "pick damaged" }));
    expect(screen.getByText("Pick a category to enable saving.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await fireEvent.press(
      screen.getByRole("checkbox", { name: "Water & Sanitation" }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ category: "water" }),
    );
  });

  it("marks a draft location and goes back to the camera", async () => {
    await render(
      <CaptureTagForm
        {...props}
        category="roads"
        location={{ ...props.location, flags: ["gps_unverified"] }}
      />,
    );
    expect(screen.getByText("Draft · location not verified")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Back to camera" }),
    );
    expect(props.onBack).toHaveBeenCalled();
  });
});
