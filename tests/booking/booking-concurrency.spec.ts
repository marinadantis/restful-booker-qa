import { test, expect } from "../fixtures/api-fixtures";
import { createBooking } from "../fixtures/booking-data";
import { Booking, BookingResponse } from "../../src/types/booking";
import { isDeepStrictEqual } from "node:util";
import { cleanupBooking } from "../helpers/booking-cleanup";

test("concurrent PUT requests should leave the booking in a valid final state", async ({
  bookingApi,
  authToken,
}) => {
  let bookingId: number | undefined;
  try {
    // Arrange: create a booking we control.
    const originalBooking = createBooking();

    const createResponse = await bookingApi.createBooking(originalBooking);
    expect(createResponse.status()).toBe(200);

    const createdBooking = (await createResponse.json()) as BookingResponse;
    bookingId = createdBooking.bookingid;

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
      bookingApi.updateBooking(bookingId, payloadA, authToken),
      bookingApi.updateBooking(bookingId, payloadB, authToken),
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
      const token = authToken;
      await cleanupBooking(bookingApi, bookingId, token);
    }
  }
});
