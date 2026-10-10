import type { Booking } from "../types/booking";
import type { APIRequestContext } from "@playwright/test";

export class BookingApi {
  constructor(private readonly request: APIRequestContext) {}

  async createBooking(booking: Booking) {
    return this.request.post("/booking", {
      data: booking,
    });
  }

  async getBooking(bookingId: number) {
    return this.request.get(`/booking/${bookingId}`);
  }

  async updateBooking(bookingId: number, booking: Booking, token: string) {
    return this.request.put(`/booking/${bookingId}`, {
      data: booking,
      headers: {
        Cookie: `token=${token}`,
      },
    });
  }

  async partiallyUpdateBooking(
    bookingId: number,
    changes: Partial<Booking>,
    token: string,
  ) {
    return this.request.patch(`/booking/${bookingId}`, {
      data: changes,
      headers: {
        Cookie: `token=${token}`,
      },
    });
  }

  async deleteBooking(bookingId: number, token: string) {
    return this.request.delete(`/booking/${bookingId}`, {
      headers: {
        Cookie: `token=${token}`,
      },
    });
  }
}
