import { test, expect } from "../fixtures/api-fixtures";
import { createBooking } from "../fixtures/booking-data";
import { ensureBookingExists } from "../helpers/booking-recovery";
import { cleanupBooking } from "../helpers/booking-cleanup";
import type { BookingResponse } from "../../src/types/booking";

test("should recreate a booking when the original prerequisite disappears", async ({
  bookingApi,
  authToken,
}) => {
  let bookingId: number | undefined;

  try {
    // Arrange: create a booking.
    const originalBooking = createBooking();
    const createResponse = await bookingApi.createBooking(originalBooking);

    expect(createResponse.status()).toBe(200);
    const created = (await createResponse.json()) as BookingResponse;
    bookingId = created.bookingid;

    // Simulate shared-sandbox interference by deleting the booking.
    const deleteResponse = await bookingApi.deleteBooking(bookingId, authToken);
    expect(deleteResponse.status()).toBe(201);
    const missingResponse = await bookingApi.getBooking(bookingId);
    expect(missingResponse.status()).toBe(404);

    // Act: recover the missing prerequisite.
    const recoveredBookingId = await ensureBookingExists(
      bookingApi,
      bookingId,
      originalBooking,
    );
    bookingId = recoveredBookingId;

    // Assert: recovery created a usable booking with the original data.
    expect(recoveredBookingId).not.toBe(created.bookingid);
    const recoveredResponse = await bookingApi.getBooking(recoveredBookingId);
    expect(recoveredResponse.status()).toBe(200);
    expect(await recoveredResponse.json()).toEqual(originalBooking);
  } finally {
    if (bookingId !== undefined) {
      await cleanupBooking(bookingApi, bookingId, authToken);
    }
  }
});
