import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { SettingsSection } from "../SettingsSection";

describe("SettingsSection", () => {
  it("heads its rows and skips the empty ones", async () => {
    const hidden = false;
    await render(
      <SettingsSection title="Sync">
        <Text>Upload photos on Wi-Fi only</Text>
        {hidden ? <Text>Update available</Text> : null}
        <Text>Last synced</Text>
      </SettingsSection>,
    );
    expect(screen.getByRole("header", { name: "Sync" })).toBeOnTheScreen();
    expect(screen.getByText("Last synced")).toBeOnTheScreen();
    expect(screen.queryByText("Update available")).not.toBeOnTheScreen();
  });
});
