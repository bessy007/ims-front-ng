import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE_URL = 'http://localhost:8080/api';

@Injectable({ providedIn: 'root' })
export class SupplyService {
  private readonly http = inject(HttpClient);

  createSupplyDocument(payload: unknown): Observable<any> {
    return this.http.post(`${API_BASE_URL}/supplies`, payload);
  }

  getSupplyDocument(id: number | string): Observable<any> {
    return this.http.get(`${API_BASE_URL}/supplies/${id}`);
  }

  updateSupplyDocument(id: number | string, payload: unknown): Observable<any> {
    return this.http.put(`${API_BASE_URL}/supplies/${id}`, payload);
  }

  confirmSupplyDocument(id: number | string): Observable<any> {
    return this.http.post(`${API_BASE_URL}/supplies/${id}/confirm`, {});
  }

  reopenSupplyDocument(id: number | string): Observable<any> {
    return this.http.post(`${API_BASE_URL}/supplies/${id}/reopen`, {});
  }

  deleteSupplyDocument(id: number | string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/supplies/${id}`);
  }

  getSupplyPdf(id: number | string): Observable<Blob> {
    return this.http.get(`${API_BASE_URL}/supplies/${id}/pdf`, {
      responseType: 'blob',
    });
  }

  addSupplyItem(supplyDocumentId: number | string, payload: unknown): Observable<any> {
    return this.http.post(`${API_BASE_URL}/supply-items/document/${supplyDocumentId}`, payload);
  }

  updateSupplyItem(id: number | string, payload: unknown): Observable<any> {
    return this.http.put(`${API_BASE_URL}/supply-items/${id}`, payload);
  }

  deleteSupplyItem(id: number | string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/supply-items/${id}`);
  }

  searchSupplyDocuments(filters: {
    q?: string;
    status?: string;
    page?: number;
    size?: number;
    sort?: string;
  }): Observable<any> {
    return this.http.get(`${API_BASE_URL}/supplies`, {
      params: this.makeParams({
        q: filters.q || undefined,
        status: filters.status || undefined,
        page: filters.page ?? 0,
        size: filters.size ?? 20,
        sort: filters.sort ?? 'documentDate,desc',
      }),
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
