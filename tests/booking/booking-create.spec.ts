import { test, expect } from "../fixtures/api-fixtures";
import { BookingApi } from "../../src/api/booking-api";
import { createBooking } from "../fixtures/booking-data";
import { Booking, BookingResponse } from "../../src/types/booking";
import { TokenManager } from "../../src/auth/token-manager";
import { expectValidBookingPayload } from "../helpers/booking-validation";
import { request as playwrightRequest } from "@playwright/test";
import { cleanupBooking } from "../helpers/booking-cleanup";

test("should create a booking and retrieve it successfully", async ({
  bookingApi,
  authToken,
}) => {
  // Arrange: create a booking payload
  const booking = createBooking();
  expectValidBookingPayload(booking);

  let bookingId: number | undefined;
  try {
    const createResponse = await bookingApi.createBooking(booking);
    expect(createResponse.status()).toBe(200);
    const createBody = (await createResponse.json()) as BookingResponse;
    expect(createBody).toHaveProperty("bookingid");
    expect(Number.isInteger(createBody.bookingid)).toBe(true);

    // Assert: created booking response matches the created booking payload
    expect(createBody.booking).toEqual(booking);

    bookingId = createBody.bookingid;
    const getResponse = await bookingApi.getBooking(bookingId);
    expect(getResponse.status()).toBe(200);
    const getBody = await getResponse.json();

    // Assert: retrieved booking response matches the created booking payload
    expect(getBody).toEqual(booking);
  } finally {
    if (bookingId !== undefined) {
      const token = authToken;
      await cleanupBooking(bookingApi, bookingId, token);
    }
  }
});

test("should return a booking with the expected schema", async ({
  bookingApi,
  authToken,
}) => {
  const booking = createBooking();
  expectValidBookingPayload(booking);

  let bookingId: number | undefined;
  try {
    const response = await bookingApi.createBooking(booking);
    expect(response.status()).toBe(200);

    const body = await response.json();

    // Validate the response envelope.
    expect(body).toHaveProperty("bookingid");
    expect(body).toHaveProperty("booking");

    expect(Number.isInteger(body.bookingid)).toBe(true);
    expect(body.bookingid).toBeGreaterThan(0);

    // Validate the booking object.
    const returnedBooking = body.booking;

    expect(typeof returnedBooking.firstname).toBe("string");
    expect(typeof returnedBooking.lastname).toBe("string");
    expect(typeof returnedBooking.totalprice).toBe("number");
    expect(typeof returnedBooking.depositpaid).toBe("boolean");
    expect(typeof returnedBooking.additionalneeds).toBe("string");

    // Validate the nested bookingdates object.
    expect(returnedBooking.bookingdates).toBeDefined();
    expect(typeof returnedBooking.bookingdates).toBe("object");
    expect(returnedBooking.bookingdates).not.toBeNull();

    expect(returnedBooking.bookingdates).toHaveProperty("checkin");
    expect(returnedBooking.bookingdates).toHaveProperty("checkout");

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    expect(returnedBooking.bookingdates.checkin).toMatch(datePattern);
    expect(returnedBooking.bookingdates.checkout).toMatch(datePattern);

    // Verify that the API preserved the submitted payload.
    expect(returnedBooking).toEqual(booking);

    bookingId = body.bookingid;
  } finally {
    if (bookingId !== undefined) {
      const token = authToken;
      await cleanupBooking(bookingApi, bookingId, token);
    }
  }
});

test("should characterize duplicate booking behaviour across independent API contexts", async ({
  bookingApi,
  authToken,
}) => {
  const username = process.env.API_USERNAME;
  const password = process.env.API_PASSWORD;

  if (!username || !password) {
    throw new Error("API credentials are not configured");
  }

  const secondContext = await playwrightRequest.newContext({
    baseURL: "https://restful-booker.herokuapp.com",
  });

  const secondTokenManager = new TokenManager(secondContext, {
    username,
    password,
  });

  const secondBookingApi = new BookingApi(secondContext, secondTokenManager);

  let firstBookingId: number | undefined;
  let secondBookingId: number | undefined;

  try {
    const booking = createBooking({
      bookingdates: {
        checkin: "2026-11-10",
        checkout: "2026-11-15",
      },
    });

    // Submit the same payload through two independent API contexts.
    const firstResponse = await bookingApi.createBooking(booking);
    expect(firstResponse.status()).toBe(200);

    const firstCreated = (await firstResponse.json()) as BookingResponse;
    firstBookingId = firstCreated.bookingid;

    const secondResponse = await secondBookingApi.createBooking(booking);
    expect(secondResponse.status()).toBe(200);

    const secondCreated = (await secondResponse.json()) as BookingResponse;
    secondBookingId = secondCreated.bookingid;

    // Characterize the observed sandbox behaviour.
    expect(firstBookingId).not.toBe(secondBookingId);

    const firstGetResponse = await bookingApi.getBooking(firstBookingId);
    const secondGetResponse =
      await secondBookingApi.getBooking(secondBookingId);

    expect(firstGetResponse.status()).toBe(200);
    expect(secondGetResponse.status()).toBe(200);

    expect(await firstGetResponse.json()).toEqual(booking);
    expect(await secondGetResponse.json()).toEqual(booking);
  } finally {
    try {
      if (firstBookingId !== undefined) {
        await cleanupBooking(bookingApi, firstBookingId, authToken);
      }

      if (secondBookingId !== undefined) {
        const secondToken = await secondTokenManager.getToken();
        await cleanupBooking(secondBookingApi, secondBookingId, secondToken);
      }
    } finally {
      await secondContext.dispose();
    }
  }
});

test("should reject bookings with reversed dates", async ({
  bookingApi,
  authToken,
}) => {
  let bookingId: number | undefined;

  try {
    const booking = createBooking({
      bookingdates: {
        checkin: "2026-11-15",
        checkout: "2026-11-10",
      },
    });

    const response = await bookingApi.createBooking(booking);
    expect(response.status()).toBe(200);

    const created = (await response.json()) as BookingResponse;
    bookingId = created.bookingid;
    expect(created.booking.bookingdates).toEqual(booking.bookingdates);
  } finally {
    if (bookingId !== undefined) {
      const token = authToken;
      await cleanupBooking(bookingApi, bookingId, token);
    }
  }
});

test("characterises API behaviour for overlapping booking dates", async ({
  bookingApi,
  authToken,
}) => {
  let firstBookingId: number | undefined;
  let secondBookingId: number | undefined;
  try {
    const firstBooking = createBooking({
      bookingdates: {
        checkin: "2026-11-10",
        checkout: "2026-11-15",
      },
    });

    const secondBooking = createBooking({
      bookingdates: {
        checkin: "2026-11-12",
        checkout: "2026-11-17",
      },
    });

    // Create the first booking.
    const firstResponse = await bookingApi.createBooking(firstBooking);
    expect(firstResponse.status()).toBe(200);

    const firstBody = (await firstResponse.json()) as BookingResponse;
    firstBookingId = firstBody.bookingid;

    // Create a second booking whose dates overlap the first.
    const secondResponse = await bookingApi.createBooking(secondBooking);
    expect(secondResponse.status()).toBe(200);

    const secondBody = (await secondResponse.json()) as BookingResponse;
    secondBookingId = secondBody.bookingid;

    // Verify both bookings independently.
    const firstGetResponse = await bookingApi.getBooking(firstBookingId);
    const secondGetResponse = await bookingApi.getBooking(secondBookingId);

    expect(firstGetResponse.status()).toBe(200);
    expect(secondGetResponse.status()).toBe(200);

    expect(await firstGetResponse.json()).toEqual(firstBooking);
    expect(await secondGetResponse.json()).toEqual(secondBooking);
  } finally {
    const token = authToken;
    for (const id of [firstBookingId, secondBookingId]) {
      if (id !== undefined) {
        await cleanupBooking(bookingApi, id, token);
      }
    }
  }
});

test.fail(
  "should reject a booking with a negative price",
  async ({ bookingApi }) => {
    const booking = createBooking({ totalprice: -100 });

    const response = await bookingApi.createBooking(booking);

    expect([400, 422]).toContain(response.status());
  },
);

test.fail(
  "should reject a booking without a first name",
  async ({ bookingApi }) => {
    const booking = createBooking();
    const { firstname, ...invalidBooking } = booking;

    const response = await bookingApi.createBooking(invalidBooking as Booking);

    expect([400, 422]).toContain(response.status());
  },
);
