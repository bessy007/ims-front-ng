import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE_URL = 'http://localhost:8080/api';

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private readonly http = inject(HttpClient);

  getProductsSold(filters: { dateFrom: string; dateTo: string }): Observable<any> {
    return this.http.get(`${API_BASE_URL}/statistics/products-sold`, {
      params: this.makeParams(filters),
    });
  }

  getCashReportSummary(filters: { dateFrom: string; dateTo: string }): Observable<any> {
    return this.http.get(`${API_BASE_URL}/statistics/cash-report/summary`, {
      params: this.makeParams(filters),
    });
  }

  getCashReportDailyAll(filters: { dateFrom: string; dateTo: string }): Observable<any> {
    return this.http.get(`${API_BASE_URL}/statistics/cash-report/daily-all`, {
      params: this.makeParams(filters),
    });
  }

  getCustomerSalesTransactions(filters: {
    customerId: number;
    dateFrom: string;
    dateTo: string;
  }): Observable<any> {
    return this.http.get(`${API_BASE_URL}/statistics/customer-sales/transactions`, {
      params: this.makeParams(filters),
    });
  }

  getCustomerSalesDaily(filters: {
    customerId: number;
    dateFrom: string;
    dateTo: string;
  }): Observable<any> {
    return this.http.get(`${API_BASE_URL}/statistics/customer-sales/daily`, {
      params: this.makeParams(filters),
    });
  }

  getCustomersWholesaleRetail(filters: { dateFrom: string; dateTo: string }): Observable<any> {
    return this.http.get(`${API_BASE_URL}/statistics/customers-wholesale-retail`, {
      params: this.makeParams(filters),
    });
  }

  getProductStatistics(filters: {
    productId: number;
    dateFrom: string;
    dateTo: string;
  }): Observable<any> {
    return this.http.get(`${API_BASE_URL}/statistics/product/${filters.productId}`, {
      params: this.makeParams({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
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
