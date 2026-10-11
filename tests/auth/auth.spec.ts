import { test, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { TokenManager } from "../../src/auth/token-manager";
import { BookingApi } from "../../src/api/booking-api";
import { createBooking } from "../fixtures/booking-data";

test("should reuse one token for concurrent requests", async ({ request }) => {
  const username = process.env.API_USERNAME;
  const password = process.env.API_PASSWORD;

  if (!username || !password)
    throw new Error("API credentials are not configured");

  const tokenManager = new TokenManager(request, {
    username,
    password,
  });

  const tokens = await Promise.all(
    Array.from({ length: 5 }, () => tokenManager.getToken()),
  );

  expect(tokens).toHaveLength(5);

  for (const token of tokens) {
    expect(token).toBeTruthy();
    expect(token).toBe(tokens[0]);
  }
});

test("deduplicates concurrent token requests", async ({ request }) => {
  let authRequestCount = 0;

  const fakeRequest = {
    post: async (url: string) => {
      if (url === "/auth") {
        authRequestCount++;

        // Simulate network latency so concurrent calls overlap.
        await new Promise((resolve) => setTimeout(resolve, 50));

        return {
          ok: () => true,
          status: () => 200,
          json: async () => ({ token: "test-token" }),
        };
      }

      throw new Error(`Unexpected request: ${url}`);
    },
  } as unknown as APIRequestContext;

  const tokenManager = new TokenManager(fakeRequest, {
    username: "admin",
    password: "password123",
  });

  const tokens = await Promise.all(
    Array.from({ length: 5 }, () => tokenManager.getToken()),
  );

  // Ensure every single token in the array matches your expected string
  for (const token of tokens) {
    expect(token).toBe("test-token");
  }

  // Assert: Auth is called only once for 5 concurrent calls
  expect(authRequestCount).toBe(1);
});

test("refreshes an expired token and retries the booking update", async () => {
  let authRequestCount = 0;
  let updateRequestCount = 0;

  const tokensUsed: string[] = [];

  const fakeRequest = {
    post: async (url: string) => {
      if (url !== "/auth") {
        throw new Error(`Unexpected POST request: ${url}`);
      }

      authRequestCount++;

      const token = authRequestCount === 1 ? "token-A" : "token-B";

      return {
        ok: () => true,
        status: () => 200,
        json: async () => ({ token }),
      };
    },

    put: async (
      url: string,
      options?: { headers?: Record<string, string> },
    ) => {
      updateRequestCount++;

      tokensUsed.push(options?.headers?.Cookie ?? "");

      if (url !== "/booking/123") {
        throw new Error(`Unexpected PUT request: ${url}`);
      }

      // The original token fails; the replacement token succeeds.
      if (options?.headers?.Cookie === "token=token-A") {
        return { status: () => 403 };
      }

      if (options?.headers?.Cookie === "token=token-B") {
        return { status: () => 200 };
      }

      throw new Error("Unexpected authentication token");
    },
  } as unknown as APIRequestContext;

  const tokenManager = new TokenManager(fakeRequest, {
    username: "admin",
    password: "password123",
  });

  const bookingApi = new BookingApi(fakeRequest, tokenManager);

  // Obtain the initial token.
  const initialToken = await tokenManager.getToken();

  expect(initialToken).toBe("token-A");

  // Attempt an update using the initial token.
  const response = await bookingApi.updateBooking(
    123,
    createBooking(),
    initialToken,
  );

  // Verify that the retry succeeded.
  expect(response.status()).toBe(200);

  // Two authentication requests: initial token and replacement token.
  expect(authRequestCount).toBe(2);

  // Two update requests: original attempt and retry.
  expect(updateRequestCount).toBe(2);

  expect(tokensUsed).toEqual(["token=token-A", "token=token-B"]);
});
