import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { UserSession } from '../models/api.models';

const API_BASE_URL = 'http://localhost:8080/api';
const TOKEN_KEY = 'ims_token';
const USER_KEY = 'ims_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenState = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly token = computed(() => this.tokenState());
  readonly isAuthenticated = computed(() => !!this.tokenState());

  login(credentials: { username: string; password: string }) {
    return this.http
      .post<UserSession>(`${API_BASE_URL}/auth/login`, credentials)
      .pipe(
        tap((session) => {
          const token = String(session.token ?? '');
          this.setToken(token);
          localStorage.setItem(USER_KEY, JSON.stringify(session));
        }),
      );
  }

  setToken(token: string | null) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }

    this.tokenState.set(token);
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.tokenState.set(null);
  }

  getStoredUser(): UserSession | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as UserSession) : null;
    } catch {
      return null;
    }
  }
}
