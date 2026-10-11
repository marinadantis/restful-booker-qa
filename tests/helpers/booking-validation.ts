import { expect } from "@playwright/test";
import type { Booking } from "../../src/types/booking";

export function expectValidBookingPayload(booking: Booking): void {
  // Validate price
  expect(typeof booking.totalprice).toBe("number");
  expect(Number.isFinite(booking.totalprice)).toBe(true);
  expect(booking.totalprice).toBeGreaterThanOrEqual(0);

  // Validate deposit flag
  expect(typeof booking.depositpaid).toBe("boolean");

  // Validate nested booking dates
  expect(booking.bookingdates).toBeDefined();
  expect(booking.bookingdates).toHaveProperty("checkin");
  expect(booking.bookingdates).toHaveProperty("checkout");

  const { checkin, checkout } = booking.bookingdates;

  // Validate YYYY-MM-DD format
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  expect(checkin).toMatch(datePattern);
  expect(checkout).toMatch(datePattern);

  // Validate that the dates are real calendar dates
  expect(new Date(`${checkin}T00:00:00.000Z`).toISOString().slice(0, 10)).toBe(
    checkin,
  );

  expect(new Date(`${checkout}T00:00:00.000Z`).toISOString().slice(0, 10)).toBe(
    checkout,
  );

  // Validate checkout is after checkin
  expect(checkout > checkin).toBe(true);
}
