import { TokenManager } from "../auth/token-manager";
import type { Booking } from "../types/booking";
import type { APIRequestContext, APIResponse } from "@playwright/test";

export class BookingApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly tokenManager: TokenManager,
  ) {}

  private async withAuthRetry(
    operation: (token: string) => Promise<APIResponse>,
    token: string,
  ): Promise<APIResponse> {
    // Attempt the operation with the current token.
    let response = await operation(token);

    // Retry once if authentication fails.
    if (response.status() === 401 || response.status() === 403) {
      const refreshedToken = await this.tokenManager.getToken(token);

      response = await operation(refreshedToken);
    }

    return response;
  }

  async createBooking(booking: Booking) {
    return this.request.post("/booking", {
      data: booking,
    });
  }

  async getBooking(bookingId: number) {
    return this.request.get(`/booking/${bookingId}`);
  }

  async updateBooking(bookingId: number, booking: Booking, token: string) {
    return this.withAuthRetry(
      (currentToken) =>
        this.request.put(`/booking/${bookingId}`, {
          data: booking,
          headers: {
            Cookie: `token=${currentToken}`,
          },
        }),
      token,
    );
  }

  async partiallyUpdateBooking(
    bookingId: number,
    changes: Partial<Booking>,
    token: string,
  ) {
    return this.withAuthRetry(
      (currentToken) =>
        this.request.patch(`/booking/${bookingId}`, {
          data: changes,
          headers: {
            Cookie: `token=${currentToken}`,
          },
        }),
      token,
    );
  }

  async deleteBooking(bookingId: number, token: string) {
    return this.withAuthRetry(
      (currentToken) =>
        this.request.delete(`/booking/${bookingId}`, {
          headers: {
            Cookie: `token=${currentToken}`,
          },
        }),
      token,
    );
  }
}
