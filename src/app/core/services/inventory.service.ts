import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE_URL = 'http://localhost:8080/api';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);

  getProduct(id: number | string): Observable<any> {
    return this.http.get(`${API_BASE_URL}/products/${id}`);
  }

  createProduct(payload: unknown): Observable<any> {
    return this.http.post(`${API_BASE_URL}/products`, payload);
  }

  updateProduct(id: number | string, payload: unknown): Observable<any> {
    return this.http.put(`${API_BASE_URL}/products/${id}`, payload);
  }

  deleteProduct(id: number | string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/products/${id}`);
  }

  searchProductsList(filters: {
    q?: string;
    articleNumber?: string;
    barcode?: string;
    brandId?: number;
    categoryId?: number;
    active?: boolean;
  }, params: { page?: number; size?: number; sort?: string } = {}): Observable<any> {
    return this.http.get(`${API_BASE_URL}/products/list`, {
      params: this.makeParams({
        q: filters.q || undefined,
        articleNumber: filters.articleNumber || undefined,
        barcode: filters.barcode || undefined,
        brandId: filters.brandId,
        categoryId: filters.categoryId,
        active: filters.active,
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'name,asc',
      }),
    });
  }

  searchTecDocArticles(filters: { articleNumber: string; brandId?: number }): Observable<any> {
    return this.http.get(`${API_BASE_URL}/tecdoc/search`, {
      params: this.makeParams({
        articleNumber: filters.articleNumber,
        brandId: filters.brandId,
      }),
    });
  }

  getTecDocArticleDetails(filters: { articleNo: string; brandId?: number }): Observable<any> {
    return this.http.get(`${API_BASE_URL}/tecdoc/article-details`, {
      params: this.makeParams({
        articleNo: filters.articleNo,
        brandId: filters.brandId,
      }),
    });
  }

  posSearchProducts(filters: {
    q?: string;
    warehouseId?: number | null;
    page?: number;
    size?: number;
  }): Observable<any> {
    return this.http.get(`${API_BASE_URL}/products/pos-search`, {
      params: this.makeParams({
        q: filters.q,
        warehouseId: filters.warehouseId ?? undefined,
        page: filters.page ?? 0,
        size: filters.size ?? 20,
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
