import type { CommandType } from './models';

export interface OpisNaredbe {
  vrijednost: CommandType;
  naziv: string;
  /// mijenja li naredba stanje rasvjete
  mijenjaSvjetlo: boolean;
}

/// popis je ovdje, a ne u komponenti, jer ga koriste i ekran naredbi i detalj
/// svjetiljke - dvije kopije bi se prije ili kasnije razisle
export const NAREDBE: OpisNaredbe[] = [
  { vrijednost: 'REQUEST_STATUS', naziv: 'Zatraži status', mijenjaSvjetlo: false },
  { vrijednost: 'REQUEST_ENERGY', naziv: 'Zatraži potrošnju', mijenjaSvjetlo: false },
  { vrijednost: 'TURN_ON', naziv: 'Upali', mijenjaSvjetlo: true },
  { vrijednost: 'TURN_OFF', naziv: 'Ugasi', mijenjaSvjetlo: true },
  { vrijednost: 'SET_BRIGHTNESS', naziv: 'Postavi svjetlinu', mijenjaSvjetlo: true },
];

export function opisNaredbe(c: CommandType): OpisNaredbe | undefined {
  return NAREDBE.find((n) => n.vrijednost === c);
}

export function nazivNaredbe(c: CommandType): string {
  return opisNaredbe(c)?.naziv ?? c;
}
