import { test, expect } from "../fixtures/api-fixtures";
import { createBooking } from "../fixtures/booking-data";
import { Booking, BookingResponse } from "../../src/types/booking";
import { cleanupBooking } from "../helpers/booking-cleanup";
import { ensureBookingExists } from "../helpers/booking-recovery";

test("PUT should be idempotent when the same payload is sent three times", async ({
  bookingApi,
  authToken,
}) => {
  let bookingId: number | undefined;
  try {
    // Arrange: create a booking with a known initial state.
    const initialBooking = createBooking({
      totalprice: 200,
      depositpaid: false,
      additionalneeds: "Initial booking",
    });

    const createResponse = await bookingApi.createBooking(initialBooking);
    expect(createResponse.status()).toBe(200);

    const createBody = (await createResponse.json()) as BookingResponse;
    bookingId = createBody.bookingid;

    // Define the complete replacement payload.
    const updatedBooking: Booking = {
      ...initialBooking,
      totalprice: 350,
      depositpaid: true,
      additionalneeds: "Breakfast and Wi-Fi",
    };

    const snapshots: Booking[] = [];

    // Act: send the exact same PUT payload three times.
    for (let attempt = 1; attempt <= 3; attempt++) {
      const updateResponse = await bookingApi.updateBooking(
        bookingId,
        updatedBooking,
        authToken,
      );
      expect(updateResponse.status()).toBe(200);

      const updateBody = await updateResponse.json();
      expect(updateBody).toEqual(updatedBooking);

      // Verify persisted state, not just the update response.
      const getResponse = await bookingApi.getBooking(bookingId);
      expect(getResponse.status()).toBe(200);

      const persistedBooking = await getResponse.json();
      expect(persistedBooking).toEqual(updatedBooking);

      snapshots.push(persistedBooking);
    }

    // Assert: every repeated PUT leaves the resource in the same state.
    expect(snapshots[1]).toEqual(snapshots[0]);
    expect(snapshots[2]).toEqual(snapshots[0]);
  } finally {
    if (bookingId !== undefined) {
      await cleanupBooking(bookingApi, bookingId, authToken);
    }
  }
});

test("PATCH should update one field while preserving all other fields", async ({
  bookingApi,
  authToken,
}) => {
  let bookingId: number | undefined;
  try {
    // Arrange: create a booking with known values.
    const initialBooking = createBooking({
      totalprice: 200,
      depositpaid: false,
      additionalneeds: "Initial booking",
    });

    const createResponse = await bookingApi.createBooking(initialBooking);
    expect(createResponse.status()).toBe(200);

    const createdBooking = (await createResponse.json()) as BookingResponse;
    bookingId = createdBooking.bookingid;

    // Act: modify only totalprice.
    const updatedPrice = 450;

    const patchResponse = await bookingApi.partiallyUpdateBooking(
      bookingId,
      { totalprice: updatedPrice },
      authToken,
    );
    expect(patchResponse.status()).toBe(200);
    const patchBody = (await patchResponse.json()) as Booking;
    expect(patchBody.totalprice).toBe(updatedPrice);

    // Assert: retrieve and verify the complete persisted booking.
    const getResponse = await bookingApi.getBooking(bookingId);
    expect(getResponse.status()).toBe(200);

    const persistedBooking = (await getResponse.json()) as Booking;

    // The complete object must match the original, except for totalprice.
    expect(persistedBooking).toEqual({
      ...initialBooking,
      totalprice: updatedPrice,
    });
  } finally {
    if (bookingId !== undefined) {
      await cleanupBooking(bookingApi, bookingId, authToken);
    }
  }
});
