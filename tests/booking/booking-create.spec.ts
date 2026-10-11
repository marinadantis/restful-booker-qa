import { test, expect } from "@playwright/test";
import { BookingApi } from "../../src/api/booking-api";
import { createBooking } from "../fixtures/booking-data";
import { BookingResponse } from "../../src/types/booking";
import { TokenManager } from "../../src/auth/token-manager";

test("should create a booking and retrieve it successfully", async ({
  request,
}) => {
  const username = process.env.API_USERNAME;
  const password = process.env.API_PASSWORD;

  if (!username || !password) {
    throw new Error("API credentials are not configured");
  }

  const tokenManager = new TokenManager(request, {
    username,
    password,
  });

  const token = await tokenManager.getToken();

  const bookingApi = new BookingApi(request, tokenManager);

  //create a booking payload
  const booking = createBooking();

  let bookingId: number | undefined;
  try {
    const createResponse = await bookingApi.createBooking(booking);
    expect(createResponse.status()).toBe(200);
    const createBody = (await createResponse.json()) as BookingResponse;
    expect(createBody).toHaveProperty("bookingid");
    expect(Number.isInteger(createBody.bookingid)).toBe(true);
    expect(createBody.booking).toEqual(booking);

    const bookingId: number = createBody.bookingid;
    const getResponse = await bookingApi.getBooking(bookingId);
    expect(getResponse.status()).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody).toEqual(booking);
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

test("should return a booking with the expected schema", async ({
  request,
}) => {
  const username = process.env.API_USERNAME;
  const password = process.env.API_PASSWORD;

  if (!username || !password) {
    throw new Error("API credentials are not configured");
  }

  const tokenManager = new TokenManager(request, {
    username,
    password,
  });

  const token = await tokenManager.getToken();

  const bookingApi = new BookingApi(request, tokenManager);
  const booking = createBooking();

  let bookingId: number | undefined;
  try {
    const response = await bookingApi.createBooking(booking);
    expect(response.status()).toBe(200);

    const body = await response.json();

    // Validate the response structure.
    expect(body).toHaveProperty("bookingid");
    expect(body).toHaveProperty("booking");

    expect(Number.isInteger(body.bookingid)).toBe(true);
    expect(body.bookingid).toBeGreaterThan(0);

    const returnedBooking = body.booking;

    // Validate required string fields.
    expect(typeof returnedBooking.firstname).toBe("string");
    expect(typeof returnedBooking.lastname).toBe("string");

    // Validate numeric and boolean fields.
    expect(typeof returnedBooking.totalprice).toBe("number");
    expect(typeof returnedBooking.depositpaid).toBe("boolean");

    // Validate nested date fields.
    expect(typeof returnedBooking.bookingdates.checkin).toBe("string");
    expect(typeof returnedBooking.bookingdates.checkout).toBe("string");

    // Validate the submitted data was preserved.
    expect(returnedBooking).toEqual(booking);

    bookingId = body.bookingid;
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

test("characterises API behaviour for reversed booking dates", async ({
  request,
}) => {
  const username = process.env.API_USERNAME;
  const password = process.env.API_PASSWORD;

  if (!username || !password) {
    throw new Error("API credentials are not configured");
  }

  const tokenManager = new TokenManager(request, {
    username,
    password,
  });

  const token = await tokenManager.getToken();

  const bookingApi = new BookingApi(request, tokenManager);

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
    expect(created.booking.bookingdates).toEqual(booking.bookingdates);

    bookingId = created.bookingid;
    const getResponse = await bookingApi.getBooking(bookingId);
    expect(getResponse.status()).toBe(200);

    const persistedBooking = await getResponse.json();
    expect(persistedBooking.bookingdates).toEqual(booking.bookingdates);
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

test("characterises API behaviour for overlapping booking dates", async ({
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
    const bookingIds = [firstBookingId, secondBookingId].filter(
      (id): id is number => id !== undefined,
    );

    for (const bookingId of bookingIds) {
      const getResponse = await bookingApi.getBooking(bookingId);
      if (getResponse.status() === 200) {
        const deleteResponse = await bookingApi.deleteBooking(bookingId, token);
        expect(deleteResponse.status()).toBe(201);
        const verificationResponse = await bookingApi.getBooking(bookingId);
        expect(verificationResponse.status()).toBe(404);
      } else {
        expect(getResponse.status()).toBe(404);
      }
    }
  }
});
