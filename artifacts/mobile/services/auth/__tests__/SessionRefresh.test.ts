import axios, { AxiosError, type AxiosAdapter } from "axios";
import { installSessionRefresh } from "../SessionRefresh";

const mockRefresh = jest.fn();
jest.mock("../AuthService", () => ({
  refreshSession: () => mockRefresh(),
}));
jest.mock("@/services/Api", () => ({ axiosClient: {} }));

/** A client whose adapter answers each call with the next status in `statuses`. */
function clientAnswering(statuses: number[]) {
  const calls: string[] = [];
  const adapter: AxiosAdapter = async (config) => {
    calls.push(config.url ?? "");
    const status = statuses.shift() ?? 200;
    const response = { data: {}, status, statusText: "", headers: {}, config };
    if (status >= 400) {
      throw new AxiosError("fail", String(status), config, null, response);
    }
    return response;
  };
  const client = axios.create({ adapter });
  installSessionRefresh(client);
  return { client, calls };
}

beforeEach(() => mockRefresh.mockReset());

test("refreshes and retries once after a 401", async () => {
  mockRefresh.mockResolvedValue(true);
  const { client, calls } = clientAnswering([401, 200]);

  await expect(client.get("/records")).resolves.toMatchObject({ status: 200 });
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(calls).toEqual(["/records", "/records"]);
});

test("gives up after one retry when the server keeps answering 401", async () => {
  mockRefresh.mockResolvedValue(true);
  const { client, calls } = clientAnswering([401, 401, 200]);

  await expect(client.get("/records")).rejects.toMatchObject({
    response: { status: 401 },
  });
  expect(calls).toHaveLength(2);
});

test("does not retry when the refresh fails", async () => {
  mockRefresh.mockResolvedValue(false);
  const { client, calls } = clientAnswering([401]);

  await expect(client.get("/records")).rejects.toBeInstanceOf(AxiosError);
  expect(calls).toHaveLength(1);
});

test("leaves auth endpoints alone", async () => {
  const { client } = clientAnswering([401]);

  await expect(client.post("/auth/login/password")).rejects.toBeInstanceOf(
    AxiosError,
  );
  expect(mockRefresh).not.toHaveBeenCalled();
});
