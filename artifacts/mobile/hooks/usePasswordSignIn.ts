import { useAuth } from "@/providers/AuthProvider";
import { authErrorCode, passwordSignIn } from "@/services/auth/AuthService";
import { useMutation } from "@tanstack/react-query";

type Credentials = { identifier: string; password: string; persist: boolean };

/** Username/password sign-in against the local user store. */
export function usePasswordSignIn() {
  const { signIn } = useAuth();
  const mutation = useMutation({
    mutationFn: ({ identifier, password, persist }: Credentials) =>
      passwordSignIn(identifier, password, persist),
    onSuccess: signIn,
  });

  return {
    submit: mutation.mutate,
    busy: mutation.isPending,
    error: mutation.error
      ? authErrorCode(mutation.error, "server_unreachable")
      : null,
    reset: mutation.reset,
  };
}
