import { expect } from "@playwright/test";
import type { BookingApi } from "../../src/api/booking-api";

export async function cleanupBooking(
  bookingApi: BookingApi,
  bookingId: number,
  token: string,
): Promise<void> {
  // Another test may already have deleted this booking.
  const existingBooking = await bookingApi.getBooking(bookingId);

  if (existingBooking.status() === 404) {
    return;
  }

  if (existingBooking.status() !== 200) {
    throw new Error(
      `Unable to check booking ${bookingId} before cleanup: ` +
        `HTTP ${existingBooking.status()}`,
    );
  }

  // Delete the booking.
  const deleteResponse = await bookingApi.deleteBooking(bookingId, token);

  // Another test may have deleted it between GET and DELETE.
  if (deleteResponse.status() === 404) {
    return;
  }

  expect(deleteResponse.status(), `Failed to delete booking ${bookingId}`).toBe(
    201,
  );

  // Verify that the booking is gone.
  const verificationResponse = await bookingApi.getBooking(bookingId);

  if (verificationResponse.status() === 404) {
    return;
  }

  throw new Error(
    `Booking ${bookingId} still exists or could not be verified ` +
      `after cleanup: HTTP ${verificationResponse.status()}`,
  );
}
