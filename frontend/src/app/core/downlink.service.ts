import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_URL } from './config';
import type { CommandType, Downlink, Paged } from './models';

export interface CommandInput {
  lampId: number;
  command: CommandType;
  argument?: number | null;
}

@Injectable({ providedIn: 'root' })
export class DownlinkService {
  private http = inject(HttpClient);
  private base = `${API_URL}/downlinks`;

  list(opts: { page?: number; pageSize?: number; lampId?: number; pending?: boolean } = {}) {
    let params = new HttpParams();
    if (opts.page) params = params.set('page', opts.page);
    if (opts.pageSize) params = params.set('pageSize', opts.pageSize);
    if (opts.lampId) params = params.set('lampId', opts.lampId);
    if (opts.pending) params = params.set('pending', 'true');
    return this.http.get<Paged<Downlink>>(this.base, { params });
  }

  send(data: CommandInput) {
    return this.http.post<Downlink>(this.base, data);
  }

  /// radi samo dok naredba nije poslana - backend inace vraca 409
  update(id: number, data: Omit<CommandInput, 'lampId'>) {
    return this.http.put<Downlink>(`${this.base}/${id}`, data);
  }

  cancel(id: number) {
    return this.http.post<Downlink>(`${this.base}/${id}/cancel`, {});
  }

  remove(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
