import { APIRequestContext } from "@playwright/test";

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
}

export class TokenManager {
  private token: string | null = null;
  private tokenPromise: Promise<string> | null = null;

  constructor(
    private readonly request: APIRequestContext,
    private readonly credentials: AuthCredentials,
  ) {}

  async getToken(failedToken?: string): Promise<string> {
    if (failedToken && this.token === failedToken) this.token = null;

    if (this.token) return this.token;

    if (!this.tokenPromise) this.tokenPromise = this.generateToken();

    const pendingToken = this.tokenPromise;
    try {
      return await this.tokenPromise;
    } finally {
      if (this.tokenPromise === pendingToken) this.tokenPromise = null;
    }
  }

  private async generateToken(): Promise<string> {
    const response = await this.request.post("/auth", {
      data: this.credentials,
    });

    if (!response.ok())
      throw new Error(`Authentication failed with status ${response.status()}`);

    const body = (await response.json()) as AuthResponse;

    if (!body.token)
      throw new Error("Authentication response did not contain a token");

    this.token = body.token;
    return this.token;
  }

  invalidateToken(): void {
    this.token = null;
  }
}
