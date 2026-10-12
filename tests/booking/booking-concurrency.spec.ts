import { test, expect } from "../fixtures/api-fixtures";
import { createBooking } from "../fixtures/booking-data";
import { cleanupBooking } from "../helpers/booking-cleanup";
import type { Booking, BookingResponse } from "../../src/types/booking";

test("concurrent PUT requests should not leave a partially merged booking", async ({
  bookingApi,
  authToken,
}) => {
  let bookingId: number | undefined;

  try {
    // Arrange: create a booking that both clients will update.
    const initialBooking = createBooking({
      firstname: "Initial",
      lastname: "Booking",
      totalprice: 200,
      depositpaid: false,
      additionalneeds: "Original request",
    });

    const createResponse = await bookingApi.createBooking(initialBooking);
    expect(createResponse.status()).toBe(200);

    const created = (await createResponse.json()) as BookingResponse;
    bookingId = created.bookingid;

    // Define two conflicting complete replacement payloads.
    const payloadA: Booking = {
      ...initialBooking,
      firstname: "ClientA",
      totalprice: 400,
      depositpaid: false,
      additionalneeds: "Request from A",
    };

    const payloadB: Booking = {
      ...initialBooking,
      firstname: "ClientB",
      totalprice: 600,
      depositpaid: true,
      additionalneeds: "Request from B",
    };

    // Act: dispatch both PUT requests concurrently.
    const [responseA, responseB] = await Promise.all([
      bookingApi.updateBooking(bookingId, payloadA, authToken),
      bookingApi.updateBooking(bookingId, payloadB, authToken),
    ]);

    // Both requests should succeed under the observed sandbox behaviour.
    expect(responseA.status()).toBe(200);
    expect(responseB.status()).toBe(200);

    // Read the final persisted state after both requests complete.
    const finalResponse = await bookingApi.getBooking(bookingId);
    expect(finalResponse.status()).toBe(200);

    const finalBooking = (await finalResponse.json()) as Booking;

    // The final representation must match one complete payload.
    expect([payloadA, payloadB]).toContainEqual(finalBooking);
  } finally {
    if (bookingId !== undefined) {
      await cleanupBooking(bookingApi, bookingId, authToken);
    }
  }
});
