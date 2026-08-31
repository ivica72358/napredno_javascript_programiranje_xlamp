// tipovi koje vraca REST API

export type Role = 'USER' | 'ADMIN';
export type LampStatus = 'UNKNOWN' | 'ONLINE' | 'OFFLINE' | 'ERROR';
export type CommandType =
  | 'TURN_ON'
  | 'TURN_OFF'
  | 'SET_BRIGHTNESS'
  | 'REQUEST_STATUS'
  | 'REQUEST_ENERGY';

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  createdAt?: string;
  _count?: { lamps: number };
}

export interface Lamp {
  id: number;
  name: string;
  devEui: string;
  latitude: number;
  longitude: number;
  currentBrightness: number | null;
  status: LampStatus;
  lastSeen: string | null;
  ownerId: number;
  owner?: { id: number; username: string };
  createdAt: string;
  updatedAt: string;
  _count?: { uplinks: number; downlinks: number };
}

/// jedan izmjereni energetski parametar
export interface EnergyValue {
  label: string;
  value: number;
  unit: string | null;
  display: string;
}

/// rezultat dekodiranja payloada
export interface DecodedUplink {
  type: 'STATUS' | 'ENERGY' | 'ALARM' | 'BOOT' | 'UNKNOWN';
  label: string;
  raw?: string;
  deviceTime?: string;
  brightness?: number;
  profileIndex?: number;
  temperature?: number | null;
  daliStatus?: number;
  downlinkRssi?: number;
  downlinkSnr?: number;
  values?: Record<string, EnergyValue>;
  errors?: string[];
  errorBits?: number;
  cleared?: boolean;
  firmwareVersion?: string;
  meanNightDurationSeconds?: number;
}

export interface Uplink {
  id: number;
  lampId: number;
  payload: string;
  port: number | null;
  rssi: number | null;
  snr: number | null;
  receivedAt: string;
  lamp?: { id: number; name: string; devEui: string; ownerId?: number };
  decoded?: DecodedUplink;
}

export interface Downlink {
  id: number;
  lampId: number;
  command: CommandType;
  argument: number | null;
  payload: string;
  port: number;
  isSent: boolean;
  sentAt: string | null;
  error: string | null;
  cancelled: boolean;
  cancelledAt: string | null;
  createdAt: string;
  lamp?: { id: number; name: string; devEui: string; ownerId?: number };
  createdBy?: { id: number; username: string };
}

export interface Paged<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/// oblik greske koji vraca backend
export interface ApiErrorBody {
  error: string;
  details?: Record<string, string>;
}
