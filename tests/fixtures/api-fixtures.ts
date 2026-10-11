import { test as base, expect } from "@playwright/test";
import { TokenManager } from "../../src/auth/token-manager";
import { BookingApi } from "../../src/api/booking-api";

type ApiFixtures = {
  tokenManager: TokenManager;
  bookingApi: BookingApi;
  authToken: string;
};

export const test = base.extend<ApiFixtures>({
  tokenManager: async ({ request }, use) => {
    const username = process.env.API_USERNAME;
    const password = process.env.API_PASSWORD;

    if (!username || !password) {
      throw new Error("API credentials are not configured");
    }
    const manager = new TokenManager(request, {
      username,
      password,
    });
    await use(manager);
  },

  bookingApi: async ({ request, tokenManager }, use) => {
    const api = new BookingApi(request, tokenManager);
    await use(api);
  },

  authToken: async ({ tokenManager }, use) => {
    const token = await tokenManager.getToken();
    await use(token);
  },
});

export { expect };
