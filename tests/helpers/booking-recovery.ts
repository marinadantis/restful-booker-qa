import type { BookingApi } from "../../src/api/booking-api";
import type { Booking, BookingResponse } from "../../src/types/booking";

export async function ensureBookingExists(
  bookingApi: BookingApi,
  bookingId: number,
  booking: Booking,
): Promise<number> {
  const existingResponse = await bookingApi.getBooking(bookingId);

  if (existingResponse.status() === 200) {
    return bookingId;
  }

  if (existingResponse.status() !== 404) {
    throw new Error(
      `Unable to check booking ${bookingId}: HTTP ${existingResponse.status()}`,
    );
  }

  const createResponse = await bookingApi.createBooking(booking);

  if (createResponse.status() !== 200) {
    throw new Error(
      `Unable to recreate booking ${bookingId}: HTTP ${createResponse.status()}`,
    );
  }

  const created = (await createResponse.json()) as BookingResponse;

  if (!Number.isInteger(created.bookingid) || created.bookingid <= 0) {
    throw new Error("Booking recovery returned an invalid booking ID");
  }

  return created.bookingid;
}
