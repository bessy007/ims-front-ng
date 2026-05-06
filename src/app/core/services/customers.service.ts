import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE_URL = 'http://localhost:8080/api';

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly http = inject(HttpClient);

  searchCustomers(q = '', page = 0, size = 50): Observable<any> {
    return this.http.get(`${API_BASE_URL}/customers/search`, {
      params: this.makeParams({ q, page, size }),
    });
  }

  createCustomer(payload: unknown): Observable<any> {
    return this.http.post(`${API_BASE_URL}/customers`, payload);
  }

  updateCustomer(id: number, payload: unknown): Observable<any> {
    return this.http.put(`${API_BASE_URL}/customers/${id}`, payload);
  }

  deleteCustomer(id: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/customers/${id}`);
  }

  private makeParams(params: Record<string, string | number | boolean | null | undefined>) {
    let httpParams = new HttpParams();

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }

    return httpParams;
  }
}
