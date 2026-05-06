import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE_URL = 'http://localhost:8080/api';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly http = inject(HttpClient);

  createSalesDocument(payload: unknown): Observable<any> {
    return this.http.post(`${API_BASE_URL}/sales-documents`, payload);
  }

  getSalesDocument(id: number | string): Observable<any> {
    return this.http.get(`${API_BASE_URL}/sales-documents/${id}`);
  }

  updateSalesDocument(id: number | string, payload: unknown): Observable<any> {
    return this.http.put(`${API_BASE_URL}/sales-documents/${id}`, payload);
  }

  addSalesItem(salesDocumentId: number | string, payload: unknown): Observable<any> {
    return this.http.post(`${API_BASE_URL}/sales-items/document/${salesDocumentId}`, payload);
  }

  updateSalesItem(id: number | string, payload: unknown): Observable<any> {
    return this.http.put(`${API_BASE_URL}/sales-items/${id}`, payload);
  }

  deleteSalesItem(id: number | string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/sales-items/${id}`);
  }

  deleteSalesDocument(id: number | string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/sales-documents/${id}`);
  }

  updatePayment(id: number | string, paidTotal: number): Observable<any> {
    return this.http.post(`${API_BASE_URL}/sales-documents/${id}/payment`, null, {
      params: new HttpParams().set('paidTotal', String(paidTotal)),
    });
  }

  fiscalizeSalesDocument(id: number | string): Observable<any> {
    return this.http.post(`${API_BASE_URL}/sales-documents/${id}/fiscalize`, {});
  }

  confirmSalesDocument(id: number | string): Observable<any> {
    return this.http.post(`${API_BASE_URL}/sales-documents/${id}/confirm`, {});
  }

  searchSalesDocuments(filters: {
    q?: string;
    dateFrom?: string;
    dateTo?: string;
    customerId?: number;
    paymentMethod?: string;
    paid?: boolean;
  }, params: { page?: number; size?: number; sort?: string } = {}): Observable<any> {
    return this.http.get(`${API_BASE_URL}/sales-documents/list`, {
      params: this.makeParams({
        q: filters.q || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        customerId: filters.customerId,
        paymentMethod: filters.paymentMethod || undefined,
        paid: filters.paid,
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'documentDate,desc',
      }),
    });
  }

  getSalesPdf(id: number | string): Observable<Blob> {
    return this.http.get(`${API_BASE_URL}/sales-documents/${id}/pdf`, {
      responseType: 'blob',
    });
  }

  getSalesOfferPdf(payload: unknown): Observable<Blob> {
    return this.http.post(`${API_BASE_URL}/sales-documents/offer-pdf`, payload, {
      responseType: 'blob',
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
