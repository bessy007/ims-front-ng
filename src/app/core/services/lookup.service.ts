import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE_URL = 'http://localhost:8080/api';

@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly http = inject(HttpClient);

  getBrands(page = 0, size = 100): Observable<unknown> {
    return this.http.get(`${API_BASE_URL}/brands`, {
      params: this.makeParams({ page, size }),
    });
  }

  createBrand(payload: unknown): Observable<unknown> {
    return this.http.post(`${API_BASE_URL}/brands`, payload);
  }

  getCategories(page = 0, size = 100): Observable<unknown> {
    return this.http.get(`${API_BASE_URL}/categories`, {
      params: this.makeParams({ page, size }),
    });
  }

  createCategory(payload: unknown): Observable<unknown> {
    return this.http.post(`${API_BASE_URL}/categories`, payload);
  }

  getSuppliers(page = 0, size = 100): Observable<unknown> {
    return this.http.get(`${API_BASE_URL}/suppliers`, {
      params: this.makeParams({ page, size }),
    });
  }

  createSupplier(payload: unknown): Observable<unknown> {
    return this.http.post(`${API_BASE_URL}/suppliers`, payload);
  }

  getWarehouses(page = 0, size = 50): Observable<unknown> {
    return this.http.get(`${API_BASE_URL}/warehouses`, {
      params: this.makeParams({ page, size }),
    });
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
