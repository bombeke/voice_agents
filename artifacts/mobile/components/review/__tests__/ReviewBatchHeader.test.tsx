import { fireEvent, render, screen } from "@testing-library/react-native";
import { ReviewBatchHeader } from "../ReviewBatchHeader";

const TODAY = new Date();
TODAY.setHours(9, 20, 0, 0);
const BATCH = { id: "b1", downloadedAt: TODAY.toISOString(), size: 4 };

const props = {
  batch: null,
  unsent: 0,
  online: true,
  downloading: false,
  lastDownload: null,
  onDownload: () => {},
};

describe("ReviewBatchHeader", () => {
  it("offers the first download", async () => {
    const onDownload = jest.fn();
    await render(<ReviewBatchHeader {...props} onDownload={onDownload} />);
    expect(
      screen.getByText(
        "Download records to review. You can decide them offline.",
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: "Download batch" }),
    );
    expect(onDownload).toHaveBeenCalled();
  });

  it("describes the batch and the decisions left to upload", async () => {
    await render(<ReviewBatchHeader {...props} batch={BATCH} unsent={2} />);
    expect(
      screen.getByText("Batch of 4 · downloaded today 09:20"),
    ).toBeOnTheScreen();
    expect(screen.getByText("2 decisions waiting to upload")).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Download next batch" }),
    ).toBeEnabled();
  });

  it("can't download offline or while downloading", async () => {
    await render(<ReviewBatchHeader {...props} batch={BATCH} online={false} />);
    expect(
      screen.getByRole("button", { name: "Download next batch" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Connect to download a batch. Decisions made offline upload later.",
      ),
    ).toBeOnTheScreen();

    await render(<ReviewBatchHeader {...props} downloading />);
    expect(screen.getByRole("button", { name: "Downloading…" })).toBeDisabled();
  });

  it("reports the last download", async () => {
    await render(
      <ReviewBatchHeader {...props} lastDownload={{ ok: true, added: 0 }} />,
    );
    expect(
      screen.getByText("Nothing new waiting on the server."),
    ).toBeOnTheScreen();
    await render(
      <ReviewBatchHeader
        {...props}
        lastDownload={{ ok: false, reason: "error" }}
      />,
    );
    expect(
      screen.getByText("Couldn’t download the batch. Try again."),
    ).toBeOnTheScreen();
  });
});
