import { test, expect } from "@playwright/test";
import { TokenManager } from "../../src/auth/token-manager";
import { createBooking } from "../fixtures/booking-data";
import { BookingApi } from "../../src/api/booking-api";
import { Booking, BookingResponse } from "../../src/types/booking";

test("PUT should be idempotent when the same payload is sent three times", async ({
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

  const bookingApi = new BookingApi(request);

  let bookingId: number | undefined;
  try {
    // Arrange: create a booking we control.
    const initialBooking = createBooking();

    const createResponse = await bookingApi.createBooking(initialBooking);
    expect(createResponse.status()).toBe(200);

    const createBody = (await createResponse.json()) as BookingResponse;
    const bookingId: number = createBody.bookingid;

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
        token,
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

test("PATCH should update one field while preserving all other fields", async ({
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

  const bookingApi = new BookingApi(request);

  let bookingId: number | undefined;
  try {
    // Arrange: create a booking we control.
    const originalBooking = createBooking();

    const createResponse = await bookingApi.createBooking(originalBooking);
    expect(createResponse.status()).toBe(200);

    const createdBooking = (await createResponse.json()) as BookingResponse;
    const bookingId: number = createdBooking.bookingid;

    // Act: update only the price.
    const patchResponse = await bookingApi.partiallyUpdateBooking(
      bookingId,
      { totalprice: 450 },
      token,
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
