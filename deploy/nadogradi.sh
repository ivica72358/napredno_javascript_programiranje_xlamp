#!/usr/bin/env bash
#
# Nadogradnja nakon promjene koda. Pokrece se na posluzitelju:
#   sudo bash /opt/xlamp-ng/deploy/nadogradi.sh
#
# Radi samo ono sto se moglo promijeniti: povuce kod, primijeni migracije,
# ponovno izgradi frontend i restarta backend. Ne dira nginx, bazu ni .env.

set -euo pipefail

APLIKACIJA=/opt/xlamp-ng
KORISNIK=xlamp

korak() { echo; echo "==> $*"; }

if [[ $EUID -ne 0 ]]; then
  echo "Pokreni sa sudo." >&2
  exit 1
fi

korak "Povlacim kod"

# backend/backup/xlamp_ng.sql je pracena datoteka koju `npm run db:export` moze
# prepisati i ovdje. Tada bi pull odbio raditi zbog "local changes". Izvoz za
# predaju se radi lokalno i commita, pa je verzija iz repozitorija mjerodavna.
git -C "$APLIKACIJA" checkout -q -- backend/backup/ 2>/dev/null || true

PRIJE=$(git -C "$APLIKACIJA" rev-parse HEAD)
git -C "$APLIKACIJA" pull --ff-only
POSLIJE=$(git -C "$APLIKACIJA" rev-parse HEAD)

if [[ "$PRIJE" == "$POSLIJE" ]]; then
  echo "Nema promjena - nista za raditi."
  exit 0
fi

git -C "$APLIKACIJA" log --oneline "$PRIJE..$POSLIJE"

korak "Backend"
cd "$APLIKACIJA/backend"
npm ci --include=dev
npx prisma migrate deploy

korak "Frontend"
cd "$APLIKACIJA/frontend"
npm ci
npm run build

# Nova kopija se stavlja tek kad je build uspio - inace bi neuspjeh ostavio
# posluzitelj bez ijedne datoteke za posluzivanje.
rm -rf "$APLIKACIJA/frontend-dist"
cp -r "$APLIKACIJA/frontend/dist/frontend/browser" "$APLIKACIJA/frontend-dist"

chown -R "$KORISNIK:$KORISNIK" "$APLIKACIJA"

# SELinux kontekst se gubi na novokopiranim datotekama.
if command -v getenforce >/dev/null && [[ "$(getenforce)" != "Disabled" ]]; then
  restorecon -R "$APLIKACIJA/frontend-dist"
fi

korak "Restartam backend"
systemctl restart xlamp-ng
sleep 4
systemctl is-active xlamp-ng
curl -s --max-time 8 -H "Host: localhost" localhost:3000/api/health; echo

echo
echo "Gotovo."
