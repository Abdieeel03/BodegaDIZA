export type Id = number;

export type IsoDate = string;

export type IsoDateTime = string;

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message?: string;
}

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
