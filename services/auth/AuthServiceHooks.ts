import { useMutation } from "@tanstack/react-query";
import { axiosClient } from "../Api";


type ExchangeParams = {
  code: string;
  state: string;
  redirectUri: string;
};

type ExchangeResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

export function useCasdoorTokenExchange() {
  return useMutation({
    mutationFn: async (params: ExchangeParams) => {
      const res = await axiosClient.post("/auth/exchange",
        {
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(params),
        }
      );

      if (!res.data) {
        throw new Error("Casdoor token exchange failed");
      }

      return res.data as Promise<ExchangeResponse>;
    },
  });
}
