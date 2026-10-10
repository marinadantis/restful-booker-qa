import { test, expect } from "@playwright/test";
import { BookingApi } from "../../src/api/booking-api";
import { createBooking } from "../fixtures/booking-data";

test("should create a booking and retrieve it successfully", async ({
  request,
}) => {
  const bookingApi = new BookingApi(request);
  const booking = createBooking();

  const createResponse = await bookingApi.createBooking(booking);
  expect(createResponse.status()).toBe(200);
  const createBody = await createResponse.json();
  expect(createBody).toHaveProperty("bookingid");
  expect(Number.isInteger(createBody.bookingid)).toBe(true);
  expect(createBody.booking).toEqual(booking);

  const bookingId: number = createBody.bookingid;
  const getResponse = await bookingApi.getBooking(bookingId);
  expect(getResponse.status()).toBe(200);
  const getBody = await getResponse.json();
  expect(getBody).toEqual(booking);
});
