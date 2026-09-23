import type { Registration } from "@/helpers/registration";
import { register, registerErrorCode } from "@/services/auth/AuthService";
import { useMutation } from "@tanstack/react-query";

/** Creates a pending account; the user signs in only after approval. */
export function useRegister() {
  const mutation = useMutation({
    mutationFn: (registration: Registration) => register(registration),
  });

  return {
    submit: mutation.mutate,
    busy: mutation.isPending,
    done: mutation.isSuccess,
    error: mutation.error ? registerErrorCode(mutation.error) : null,
    reset: mutation.reset,
  };
}
