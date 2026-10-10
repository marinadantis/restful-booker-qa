import { test, expect } from "@playwright/test";
import { TokenManager } from "../../src/auth/token-manager";

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
