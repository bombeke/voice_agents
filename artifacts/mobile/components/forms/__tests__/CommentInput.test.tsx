import { fireEvent, render, screen } from "@testing-library/react-native";
import { CommentInput } from "../CommentInput";

const dictation = (over = {}) => ({
  available: true,
  listening: false,
  failed: false,
  toggle: jest.fn(),
  ...over,
});

describe("CommentInput", () => {
  it("edits the comment", async () => {
    const onChangeText = jest.fn();
    await render(
      <CommentInput label="Comment" value="" onChangeText={onChangeText} />,
    );
    await fireEvent.changeText(screen.getByLabelText("Comment"), "Leaning");
    expect(onChangeText).toHaveBeenCalledWith("Leaning");
  });

  it("hides the mic when voice input isn't available", async () => {
    await render(
      <CommentInput
        label="Comment"
        value=""
        onChangeText={jest.fn()}
        dictation={dictation({ available: false })}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Dictate comment" }),
    ).toBeNull();
  });

  it("dictates, and offers to stop while listening", async () => {
    const mic = dictation();
    const { rerender } = await render(
      <CommentInput
        label="Comment"
        value=""
        onChangeText={jest.fn()}
        dictation={mic}
      />,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Dictate comment" }),
    );
    expect(mic.toggle).toHaveBeenCalled();

    await rerender(
      <CommentInput
        label="Comment"
        value=""
        onChangeText={jest.fn()}
        dictation={dictation({ listening: true })}
      />,
    );
    expect(screen.getByRole("button", { name: "Stop dictation" })).toBeTruthy();
    expect(screen.getByText("Listening…")).toBeTruthy();
  });

  it("says when voice input failed", async () => {
    await render(
      <CommentInput
        label="Comment"
        value=""
        onChangeText={jest.fn()}
        dictation={dictation({ failed: true })}
      />,
    );
    expect(
      screen.getByText("Voice input didn’t work. Please type the comment."),
    ).toBeTruthy();
  });
});
