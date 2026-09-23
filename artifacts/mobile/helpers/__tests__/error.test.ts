import { parseUnknownError } from "../error";

jest.mock("react-native-executorch", () => {
  class RnExecutorchError extends Error {
    code: number;
    cause?: unknown;
    constructor(code: number, message: string, cause?: unknown) {
      super(message);
      this.code = code;
      this.cause = cause;
    }
  }
  return { RnExecutorchError, RnExecutorchErrorCode: { Internal: 999 } };
});

const { RnExecutorchError } = jest.requireMock("react-native-executorch");

describe("parseUnknownError", () => {
  it("passes an RnExecutorchError through unchanged", () => {
    const err = new RnExecutorchError(12, "model missing");
    expect(parseUnknownError(err)).toBe(err);
  });

  it("keeps the code of an error-like object", () => {
    const err = parseUnknownError({ code: 7, message: "bad input" });
    expect(err).toBeInstanceOf(RnExecutorchError);
    expect(err).toMatchObject({ code: 7, message: "bad input" });
  });

  it("wraps a plain Error as Internal with the cause", () => {
    const cause = new Error("boom");
    expect(parseUnknownError(cause)).toMatchObject({
      code: 999,
      message: "boom",
      cause,
    });
  });

  it("wraps strings and other values as Internal", () => {
    expect(parseUnknownError("oops")).toMatchObject({
      code: 999,
      message: "oops",
    });
    expect(parseUnknownError(42)).toMatchObject({ code: 999, message: "42" });
  });
});
