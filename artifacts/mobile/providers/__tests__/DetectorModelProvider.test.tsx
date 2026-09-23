import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { download } from "react-native-executorch";
import {
  DetectorModelProvider,
  useDetectorModel,
} from "../DetectorModelProvider";

const mockDownload = jest.mocked(download);

function Probe() {
  const { status, progress, retry } = useDetectorModel();
  return (
    <Text accessibilityRole="button" onPress={retry}>
      {`${status} ${progress}`}
    </Text>
  );
}

beforeEach(() => mockDownload.mockReset());

describe("DetectorModelProvider", () => {
  it("prefetches the model and reports progress, then ready", async () => {
    let finish!: () => void;
    mockDownload.mockImplementation(async (source, options) => {
      options?.onProgress?.(0.42);
      await new Promise<void>((r) => (finish = r));
      return source;
    });
    await render(
      <DetectorModelProvider>
        <Probe />
      </DetectorModelProvider>,
    );
    expect(screen.getByText("downloading 42")).toBeTruthy();
    await act(async () => finish());
    await waitFor(() => expect(screen.getByText(/^ready/)).toBeTruthy());
  });

  it("reports a failed download and retries on request", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    mockDownload.mockRejectedValueOnce(new Error("offline"));
    mockDownload.mockImplementationOnce(async (source) => source);
    await render(
      <DetectorModelProvider>
        <Probe />
      </DetectorModelProvider>,
    );
    await waitFor(() => expect(screen.getByText(/^failed/)).toBeTruthy());
    await act(async () => screen.getByRole("button").props.onPress());
    await waitFor(() => expect(screen.getByText(/^ready/)).toBeTruthy());
    expect(mockDownload).toHaveBeenCalledTimes(2);
  });
});
