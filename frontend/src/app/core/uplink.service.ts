import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_URL } from './config';
import type { Paged, Uplink } from './models';

@Injectable({ providedIn: 'root' })
export class UplinkService {
  private http = inject(HttpClient);
  private base = `${API_URL}/uplinks`;

  list(opts: { page?: number; pageSize?: number; lampId?: number } = {}) {
    let params = new HttpParams();
    if (opts.page) params = params.set('page', opts.page);
    if (opts.pageSize) params = params.set('pageSize', opts.pageSize);
    if (opts.lampId) params = params.set('lampId', opts.lampId);
    return this.http.get<Paged<Uplink>>(this.base, { params });
  }

  remove(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
