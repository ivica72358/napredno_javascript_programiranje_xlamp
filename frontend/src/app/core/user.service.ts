import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from './config';
import type { Role, User } from './models';

export interface UserCreateInput {
  username: string;
  email: string;
  password: string;
  role: Role;
}

/// lozinka je opcionalna: prazno polje znaci "ne mijenjaj je", a ne "obrisi je"
export interface UserUpdateInput {
  email?: string;
  password?: string;
  role?: Role;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private base = `${API_URL}/users`;

  /// samo administrator; obicnom korisniku backend vraca 403
  list() {
    return this.http.get<{ data: User[]; total: number }>(this.base);
  }

  get(id: number) {
    return this.http.get<User>(`${this.base}/${id}`);
  }

  create(data: UserCreateInput) {
    return this.http.post<User>(this.base, data);
  }

  update(id: number, data: UserUpdateInput) {
    return this.http.put<User>(`${this.base}/${id}`, data);
  }

  remove(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
