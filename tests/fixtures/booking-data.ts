import { Booking } from "../../src/types/booking";

export function createBooking(overrides: Partial<Booking> = {}): Booking {
  const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  return {
    firstname: `Test${uniqueId}`,
    lastname: "Space42",
    totalprice: 250,
    depositpaid: true,
    bookingdates: {
      checkin: "2026-11-10",
      checkout: "2026-11-15",
    },
    additionalneeds: "Breakfast",
    ...overrides,
  };
}
