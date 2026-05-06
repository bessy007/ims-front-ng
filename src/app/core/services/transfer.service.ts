import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE_URL = 'http://localhost:8080/api';

@Injectable({ providedIn: 'root' })
export class TransferService {
  private readonly http = inject(HttpClient);

  createTransfer(payload: unknown): Observable<any> {
    return this.http.post(`${API_BASE_URL}/stock-transfers`, payload);
  }

  getTransfer(id: number): Observable<any> {
    return this.http.get(`${API_BASE_URL}/stock-transfers/${id}`);
  }

  addTransferItem(transferId: number, payload: unknown): Observable<any> {
    return this.http.post(`${API_BASE_URL}/stock-transfers/${transferId}/items`, payload);
  }

  confirmTransfer(id: number): Observable<any> {
    return this.http.post(`${API_BASE_URL}/stock-transfers/${id}/confirm`, {});
  }
}
