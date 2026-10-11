import { Booking } from "../../src/types/booking";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function createBooking(overrides: Partial<Booking> = {}): Booking {
  const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  // Calculate dates dynamically to avoid hardcoded test dates.
  const today = new Date();
  const checkin = formatDate(addDays(today, 7));
  const checkout = formatDate(addDays(today, 12));

  return {
    firstname: `Test${uniqueId}`,
    lastname: "Space42",
    totalprice: 250,
    depositpaid: true,
    bookingdates: {
      checkin,
      checkout,
    },
    additionalneeds: "Breakfast",
    ...overrides,
  };
}
