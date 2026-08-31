import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_URL } from './config';
import type { Lamp, Paged } from './models';

export type LampInput = Pick<Lamp, 'name' | 'devEui' | 'latitude' | 'longitude'>;

@Injectable({ providedIn: 'root' })
export class LampService {
  private http = inject(HttpClient);
  private base = `${API_URL}/lamps`;

  list(opts: { page?: number; pageSize?: number; search?: string } = {}) {
    let params = new HttpParams();
    if (opts.page) params = params.set('page', opts.page);
    if (opts.pageSize) params = params.set('pageSize', opts.pageSize);
    if (opts.search) params = params.set('search', opts.search);
    return this.http.get<Paged<Lamp>>(this.base, { params });
  }

  get(id: number) {
    return this.http.get<Lamp>(`${this.base}/${id}`);
  }

  create(data: LampInput) {
    return this.http.post<Lamp>(this.base, data);
  }

  update(id: number, data: Partial<LampInput>) {
    return this.http.put<Lamp>(`${this.base}/${id}`, data);
  }

  remove(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
