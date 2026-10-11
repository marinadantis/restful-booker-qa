import { test, expect } from "@playwright/test";
import { TokenManager } from "../../src/auth/token-manager";
import { createBooking } from "../fixtures/booking-data";
import { BookingApi } from "../../src/api/booking-api";
import { Booking, BookingResponse } from "../../src/types/booking";
import { isDeepStrictEqual } from "node:util";

test("concurrent PUT requests should leave the booking in a valid final state", async ({
  request,
}) => {
  const username = process.env.API_USERNAME;
  const password = process.env.API_PASSWORD;

  if (!username || !password)
    throw new Error("API credentials are not configured");

  const tokenManager = new TokenManager(request, {
    username,
    password,
  });

  const token = await tokenManager.getToken();

  const bookingApi = new BookingApi(request, tokenManager);

  let bookingId: number | undefined;
  try {
    // Arrange: create a booking we control.
    const originalBooking = createBooking();

    const createResponse = await bookingApi.createBooking(originalBooking);
    expect(createResponse.status()).toBe(200);

    const createdBooking = (await createResponse.json()) as BookingResponse;
    const bookingId: number = createdBooking.bookingid;

    // Create two distinct, complete PUT payloads.
    const payloadA: Booking = {
      ...originalBooking,
      totalprice: 400,
      additionalneeds: "Update from client A",
    };

    const payloadB: Booking = {
      ...originalBooking,
      totalprice: 600,
      additionalneeds: "Update from client B",
    };

    // Act: initiate both updates concurrently.
    const [responseA, responseB] = await Promise.all([
      bookingApi.updateBooking(bookingId, payloadA, token),
      bookingApi.updateBooking(bookingId, payloadB, token),
    ]);

    // Both requests should succeed if the API accepts both writes.
    expect(responseA.status()).toBe(200);
    expect(responseB.status()).toBe(200);

    // Read the persisted state after both writes have completed.
    const getResponse = await bookingApi.getBooking(bookingId);
    expect(getResponse.status()).toBe(200);

    const finalBooking = (await getResponse.json()) as Booking;

    // Assert: The final state should correspond to one complete submitted payload.
    const matchesA = isDeepStrictEqual(finalBooking, payloadA);
    const matchesB = isDeepStrictEqual(finalBooking, payloadB);

    expect(
      matchesA || matchesB,
      `Final booking matched neither submitted payload: ${JSON.stringify(finalBooking)}`,
    ).toBe(true);
  } finally {
    if (bookingId !== undefined) {
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
