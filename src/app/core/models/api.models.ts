export interface PageResponse<T> {
  content?: T[];
  totalPages?: number;
  totalElements?: number;
}

export interface UserSession {
  username?: string;
  token?: string;
  [key: string]: unknown;
}
