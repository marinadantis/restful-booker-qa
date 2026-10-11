import { test, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { TokenManager } from "../../src/auth/token-manager";
import { BookingApi } from "../../src/api/booking-api";
import { createBooking } from "../fixtures/booking-data";
import { BookingResponse } from "../../src/types/booking";

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
    expect(token).toBe(tokens[0]);
  }
});

test("deduplicates concurrent token requests", async () => {
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
    username: "test-user",
    password: "test-password",
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
    username: "test-user",
    password: "test-password",
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

test("shares token refresh across concurrent failed requests", async () => {
  let authRequestCount = 0;
  let updateRequestCount = 0;

  const tokensUsed: string[] = [];

  const fakeRequest = {
    post: async (url: string) => {
      if (url !== "/auth") {
        throw new Error(`Unexpected POST request: ${url}`);
      }

      authRequestCount++;

      // Simulate network latency during token refresh.
      await new Promise((resolve) => setTimeout(resolve, 50));

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

      if (url !== "/booking/123") {
        throw new Error(`Unexpected PUT request: ${url}`);
      }

      const cookie = options?.headers?.Cookie;
      tokensUsed.push(cookie ?? "");

      if (cookie === "token=token-A") {
        return { status: () => 403 };
      }

      if (cookie === "token=token-B") {
        return { status: () => 200 };
      }

      throw new Error(`Unexpected authentication cookie: ${cookie}`);
    },
  } as unknown as APIRequestContext;

  const tokenManager = new TokenManager(fakeRequest, {
    username: "test-user",
    password: "test-password",
  });

  const bookingApi = new BookingApi(fakeRequest, tokenManager);

  // Generate the initial token.
  const initialToken = await tokenManager.getToken();

  expect(initialToken).toBe("token-A");
  expect(authRequestCount).toBe(1);

  // Send five updates concurrently using the same token.
  const responses = await Promise.all(
    Array.from({ length: 5 }, () =>
      bookingApi.updateBooking(123, createBooking(), initialToken),
    ),
  );

  // Every retry should succeed.
  for (const response of responses) {
    expect(response.status()).toBe(200);
  }

  // One initial authentication request and one shared refresh.
  expect(authRequestCount).toBe(2);

  // Five original requests plus five retries.
  expect(updateRequestCount).toBe(10);

  // Five requests should use each token.
  expect(tokensUsed.filter((token) => token === "token=token-A")).toHaveLength(
    5,
  );
  expect(tokensUsed.filter((token) => token === "token=token-B")).toHaveLength(
    5,
  );
});

test("does not retry indefinitely when refreshed authentication fails", async () => {
  let authRequestCount = 0;
  let updateRequestCount = 0;

  const fakeRequest = {
    post: async (url: string) => {
      if (url !== "/auth") {
        throw new Error(`Unexpected POST request: ${url}`);
      }

      authRequestCount++;

      return {
        ok: () => true,
        status: () => 200,
        json: async () => ({
          token: authRequestCount === 1 ? "token-A" : "token-B",
        }),
      };
    },

    put: async (url: string) => {
      if (url !== "/booking/123") {
        throw new Error(`Unexpected PUT request: ${url}`);
      }

      updateRequestCount++;

      // Both the original token and replacement token are rejected.
      return {
        status: () => 403,
      };
    },
  } as unknown as APIRequestContext;

  const tokenManager = new TokenManager(fakeRequest, {
    username: "test-user",
    password: "test-password",
  });

  const bookingApi = new BookingApi(fakeRequest, tokenManager);

  const initialToken = await tokenManager.getToken();

  expect(initialToken).toBe("token-A");

  const response = await bookingApi.updateBooking(
    123,
    createBooking(),
    initialToken,
  );

  // The final response is returned to the caller.
  expect(response.status()).toBe(403);

  // Initial authentication + one replacement token.
  expect(authRequestCount).toBe(2);

  // Original update + exactly one retry.
  expect(updateRequestCount).toBe(2);
});

test("should reject booking updates without valid authentication", async ({
  request,
}) => {
  const username = process.env.API_USERNAME;
  const password = process.env.API_PASSWORD;

  if (!username || !password) {
    throw new Error("API credentials are not configured");
  }

  const tokenManager = new TokenManager(request, {
    username,
    password,
  });

  const bookingApi = new BookingApi(request, tokenManager);
  const booking = createBooking();

  let bookingId: number | undefined;

  try {
    // Create a valid booking to use as the test prerequisite.
    const createResponse = await bookingApi.createBooking(booking);

    expect(createResponse.status()).toBe(200);

    const created = (await createResponse.json()) as BookingResponse;
    bookingId = created.bookingid;

    // Capture the original state before testing authorization.
    const originalResponse = await bookingApi.getBooking(bookingId);

    expect(originalResponse.status()).toBe(200);

    const originalBooking = await originalResponse.json();

    // Scenario 1: Update without an authentication token.
    const missingTokenResponse = await request.put(`/booking/${bookingId}`, {
      data: {
        ...booking,
        totalprice: 999,
      },
    });

    expect([401, 403]).toContain(missingTokenResponse.status());

    // Scenario 2: Update with an invalid authentication token.
    const invalidTokenResponse = await request.put(`/booking/${bookingId}`, {
      data: {
        ...booking,
        totalprice: 888,
      },
      headers: {
        Cookie: "token=invalid-token",
      },
    });

    expect([401, 403]).toContain(invalidTokenResponse.status());

    // Neither unauthorized request should modify the booking.
    const finalResponse = await bookingApi.getBooking(bookingId);

    expect(finalResponse.status()).toBe(200);
    expect(await finalResponse.json()).toEqual(originalBooking);
  } finally {
    // Clean up the booking created by this test.
    if (bookingId !== undefined) {
      const existingBooking = await bookingApi.getBooking(bookingId);

      if (existingBooking.status() === 200) {
        const token = await tokenManager.getToken();
        const deleteResponse = await bookingApi.deleteBooking(bookingId, token);

        expect(deleteResponse.status()).toBe(201);

        const verificationResponse = await bookingApi.getBooking(bookingId);

        expect(verificationResponse.status()).toBe(404);
      } else if (existingBooking.status() !== 404) {
        throw new Error(
          `Unable to verify booking before cleanup: HTTP ${existingBooking.status()}`,
        );
      }
    }
  }
});
