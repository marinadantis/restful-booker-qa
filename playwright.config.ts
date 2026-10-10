import { defineConfig } from "@playwright/test";
import "dotenv/config";

export default defineConfig({
  // Location of automated tests
  testDir: "./tests",

  // Maximum duration of an individual test
  timeout: 30_000,

  // Assertion timeout
  expect: {
    timeout: 5_000,
  },

  // Run independent tests in parallel
  fullyParallel: true,

  // Prevent accidental focused tests in CI
  forbidOnly: Boolean(process.env.CI),

  // Number of times to retry failed tests in CI
  retries: process.env.CI ? 1 : 0,

  // Limit parallel execution against the shared sandbox
  workers: process.env.CI ? 2 : 1,

  // Reporter configuration
  reporter: [["list"], ["html", { open: "never" }]],

  // API configuration
  use: {
    baseURL: "https://restful-booker.herokuapp.com",
    extraHTTPHeaders: {
      Accept: "application/json",
    },
    trace: "retain-on-failure",
  },
});
