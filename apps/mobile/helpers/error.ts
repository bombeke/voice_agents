import { RnExecutorchError, RnExecutorchErrorCode } from "react-native-executorch";

function isRnExecutorchErrorLike(
  e: unknown
): e is { code: number; message: string } {
  const candidate = e as Record<string, unknown>;

  return (
    typeof e === 'object' &&
    e !== null &&
    typeof candidate.code === 'number' &&
    typeof candidate.message === 'string'
  );
}

export function parseUnknownError(e: unknown): RnExecutorchError {
  if (e instanceof RnExecutorchError) {
    return e;
  }
  if (isRnExecutorchErrorLike(e)) {
    return new RnExecutorchError(e.code, e.message);
  }

  if (e instanceof Error) {
    return new RnExecutorchError(RnExecutorchErrorCode.Internal, e.message, e);
  }

  if (typeof e === 'string') {
    return new RnExecutorchError(RnExecutorchErrorCode.Internal, e);
  }

  return new RnExecutorchError(RnExecutorchErrorCode.Internal, String(e));
}