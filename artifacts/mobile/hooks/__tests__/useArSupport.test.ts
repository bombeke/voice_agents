import { isARSupportedOnDevice } from "@reactvision/react-viro";
import { renderHook, waitFor } from "@testing-library/react-native";
import { useArSupport } from "../useArSupport";

describe("useArSupport", () => {
  it("reports AR once the device answers", async () => {
    jest
      .mocked(isARSupportedOnDevice)
      .mockResolvedValueOnce({ isARSupported: true });
    const { result } = await renderHook(() => useArSupport());
    await waitFor(() => expect(result.current).toBe("supported"));
  });

  it("falls back to the plain camera when the check fails", async () => {
    jest
      .mocked(isARSupportedOnDevice)
      .mockRejectedValueOnce(new Error("ARCore missing"));
    const { result } = await renderHook(() => useArSupport());
    await waitFor(() => expect(result.current).toBe("unsupported"));
  });
});
