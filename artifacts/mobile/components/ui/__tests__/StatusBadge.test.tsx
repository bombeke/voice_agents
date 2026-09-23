import { render, screen } from "@testing-library/react-native";
import { RecordStatus, StatusBadge } from "../StatusBadge";

describe("StatusBadge", () => {
  it.each<[RecordStatus, string]>([
    ["synced", "Synced"],
    ["pending", "Pending"],
    ["uploading", "Uploading"],
    ["failed", "Sync failed"],
    ["flagged", "Flagged"],
    ["draft", "Draft"],
  ])("labels %s as %s", async (status, label) => {
    await render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeOnTheScreen();
    expect(screen.getByLabelText(`Status: ${label}`)).toBeOnTheScreen();
  });

  it("uses a custom label", async () => {
    await render(<StatusBadge status="pending" label="3 pending" />);
    expect(screen.getByLabelText("Status: 3 pending")).toBeOnTheScreen();
  });
});
