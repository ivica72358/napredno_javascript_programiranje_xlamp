import { Injectable, effect, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './config';
import { AuthService } from './auth.service';
import type { Downlink, Lamp, Uplink } from './models';

/// ziva veza s backendom
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private auth = inject(AuthService);
  private socket: Socket | null = null;

  readonly connected = signal(false);

  /// zadnji primljeni dogadaji
  readonly lastUplink = signal<Uplink | null>(null);
  readonly lastLampUpdate = signal<Lamp | null>(null);
  readonly lastDownlinkSent = signal<Downlink | null>(null);

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) this.connect();
      else this.disconnect();
    });
  }

  private connect(): void {
    if (this.socket) return;

    const opcije = {
      auth: { token: this.auth.token },
      // websocket prvi, polling kao rezerva
      transports: ['websocket', 'polling'],
    };

    // prazna adresa znaci isto porijeklo: u produkciji nginx sluzi i frontend i
    // API na istom hostu, pa se socket spaja tamo odakle je stranica dosla
    this.socket = SOCKET_URL ? io(SOCKET_URL, opcije) : io(opcije);

    this.socket.on('connect', () => this.connected.set(true));
    this.socket.on('disconnect', () => this.connected.set(false));
    this.socket.on('connect_error', (err) => {
      console.warn('[socket] veza nije uspjela:', err.message);
      this.connected.set(false);
    });

    this.socket.on('uplink', (u: Uplink) => this.lastUplink.set(u));
    this.socket.on('lamp:updated', (l: Lamp) => this.lastLampUpdate.set(l));
    this.socket.on('downlink:sent', (d: Downlink) => this.lastDownlinkSent.set(d));
  }

  private disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }
}
