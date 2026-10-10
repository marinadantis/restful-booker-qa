import { test, expect } from "@playwright/test";
import { BookingApi } from "../../src/api/booking-api";
import { createBooking } from "../fixtures/booking-data";
import { BookingResponse } from "../../src/types/booking";
import { TokenManager } from "../../src/auth/token-manager";

test("should create a booking and retrieve it successfully", async ({
  request,
}) => {
  const bookingApi = new BookingApi(request);

  //create a booking payload
  const booking = createBooking();

  let bookingId: number | undefined;
  try {
    const createResponse = await bookingApi.createBooking(booking);
    expect(createResponse.status()).toBe(200);
    const createBody = (await createResponse.json()) as BookingResponse;
    expect(createBody).toHaveProperty("bookingid");
    expect(Number.isInteger(createBody.bookingid)).toBe(true);
    expect(createBody.booking).toEqual(booking);

    const bookingId: number = createBody.bookingid;
    const getResponse = await bookingApi.getBooking(bookingId);
    expect(getResponse.status()).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody).toEqual(booking);
  } finally {
    if (bookingId !== undefined) {
      const username = process.env.API_USERNAME;
      const password = process.env.API_PASSWORD;

      if (!username || !password) {
        throw new Error("API credentials are not configured");
      }

      const tokenManager = new TokenManager(request, {
        username,
        password,
      });

      const token = await tokenManager.getToken();
      const existingBooking = await bookingApi.getBooking(bookingId);

      if (existingBooking.status() === 200) {
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
