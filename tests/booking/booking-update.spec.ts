import { test, expect } from "../fixtures/api-fixtures";
import { createBooking } from "../fixtures/booking-data";
import { Booking, BookingResponse } from "../../src/types/booking";
import { cleanupBooking } from "../helpers/booking-cleanup";

test("PUT should be idempotent when the same payload is sent three times", async ({
  bookingApi,
  authToken,
}) => {
  let bookingId: number | undefined;
  try {
    // Arrange: create a booking we control.
    const initialBooking = createBooking();

    const createResponse = await bookingApi.createBooking(initialBooking);
    expect(createResponse.status()).toBe(200);

    const createBody = (await createResponse.json()) as BookingResponse;
    bookingId = createBody.bookingid;

    // Act: define the complete replacement payload.
    const updatedBooking = {
      ...initialBooking,
      totalprice: 350,
      depositpaid: true,
      additionalneeds: "Breakfast and Wi-Fi",
    };

    const snapshots: Booking[] = [];

    // Repeat exactly the same PUT request three times.
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

    // Assert: the resource representation remains identical.
    expect(snapshots[1]).toEqual(snapshots[0]);
    expect(snapshots[2]).toEqual(snapshots[0]);
  } finally {
    if (bookingId !== undefined) {
      const token = authToken;
      await cleanupBooking(bookingApi, bookingId, token);
    }
  }
});

test("PATCH should update one field while preserving all other fields", async ({
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

    // Act: update only the price.
    const patchResponse = await bookingApi.partiallyUpdateBooking(
      bookingId,
      { totalprice: 450 },
      authToken,
    );
    expect(patchResponse.status()).toBe(200);

    // Assert: retrieve the persisted resource.
    const getResponse = await bookingApi.getBooking(bookingId);
    expect(getResponse.status()).toBe(200);

    const actualBooking = await getResponse.json();

    // The changed field must contain the new value.
    expect(actualBooking.totalprice).toBe(450);

    // Every other field must remain unchanged.
    expect(actualBooking.firstname).toEqual(originalBooking.firstname);
    expect(actualBooking.lastname).toEqual(originalBooking.lastname);
    expect(actualBooking.depositpaid).toEqual(originalBooking.depositpaid);
    expect(actualBooking.bookingdates).toEqual(originalBooking.bookingdates);
    expect(actualBooking.additionalneeds).toEqual(
      originalBooking.additionalneeds,
    );
  } finally {
    if (bookingId !== undefined) {
      const token = authToken;
      await cleanupBooking(bookingApi, bookingId, token);
    }
  }
});
