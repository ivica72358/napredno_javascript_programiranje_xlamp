// Izvoz baze u backup/xlamp_ng.sql.
//
// Predaja projekta trazi export baze, a `pg_dump` na Windowsu nije na PATH-u -
// instalater ga ostavi u Program Files. Skripta ga potrazi sama, procita
// pristupne podatke iz DATABASE_URL i napravi dump koji se vraca s `psql -f`.

import 'dotenv/config';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KORIJEN = join(dirname(fileURLToPath(import.meta.url)), '..');
const IZLAZ = join(KORIJEN, 'backup', 'xlamp_ng.sql');

/// Trazi pg_dump: prvo na PATH-u, pa po standardnim instalacijskim putanjama.
/// Uzima se najveca verzija - dump starijim alatom od servera zna puknuti.
function nadiPgDump() {
  const windows = process.platform === 'win32';
  const ime = windows ? 'pg_dump.exe' : 'pg_dump';

  const baze = windows
    ? ['C:\\Program Files\\PostgreSQL', 'C:\\Program Files (x86)\\PostgreSQL']
    : ['/usr/lib/postgresql', '/usr/local/pgsql', '/opt/homebrew/opt'];

  for (const baza of baze) {
    if (!existsSync(baza)) continue;

    const verzije = readdirSync(baza)
      .filter((v) => /^\d+$/.test(v))
      .sort((a, b) => Number(b) - Number(a));

    for (const v of verzije) {
      const put = join(baza, v, 'bin', ime);
      if (existsSync(put)) return put;
    }
  }

  // Nije nadeno na ocekivanim mjestima - mozda je ipak na PATH-u.
  return ime;
}

function razlomiUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || '5432',
    korisnik: decodeURIComponent(u.username),
    lozinka: decodeURIComponent(u.password),
    baza: u.pathname.replace(/^\//, ''),
  };
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL nije postavljen u .env');
  process.exit(1);
}

const veza = razlomiUrl(url);
mkdirSync(dirname(IZLAZ), { recursive: true });

const pgDump = nadiPgDump();
console.log(`Izvozim bazu "${veza.baza}" u ${IZLAZ}`);

const dijete = spawn(
  pgDump,
  [
    '--host', veza.host,
    '--port', veza.port,
    '--username', veza.korisnik,
    // Bez vlasnistva i prava: baza se na drugom racunalu vraca pod drugim
    // korisnikom, a GRANT na nepostojecu ulogu bi srusio uvoz.
    '--no-owner',
    '--no-privileges',
    // Prvo brise pa stvara tablice - ponovni uvoz ne trazi rucno ciscenje.
    '--clean',
    '--if-exists',
    '--file', IZLAZ,
    veza.baza,
  ],
  {
    // Lozinka ide kroz okolinu, ne kroz argumente: argumenti su vidljivi
    // svakome tko gleda popis procesa.
    env: { ...process.env, PGPASSWORD: veza.lozinka },
    stdio: ['ignore', 'inherit', 'inherit'],
  },
);

dijete.on('error', (err) => {
  console.error(`Ne mogu pokrenuti pg_dump (${pgDump}): ${err.message}`);
  console.error('Provjerite je li PostgreSQL instaliran i pg_dump dostupan.');
  process.exit(1);
});

dijete.on('close', (kod) => {
  if (kod === 0) console.log('Gotovo.');
  else {
    console.error(`pg_dump je zavrsio s kodom ${kod}.`);
    process.exit(kod ?? 1);
  }
});
