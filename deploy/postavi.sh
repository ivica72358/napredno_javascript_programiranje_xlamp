#!/usr/bin/env bash
#
# Postavljanje X-lampa na cist posluzitelj.
#
# Podrzano: Ubuntu 22.04/24.04 (apt) i Amazon Linux 2023 / RHEL-obitelj (dnf).
# Skripta sama prepozna koji je i prilagodi imena paketa i putanje.
#
# Pokrece se JEDNOM, sa sudo:
#   sudo bash deploy/postavi.sh https://github.com/KORISNIK/REPO.git
#
# Pisana je da se moze procitati prije pokretanja - svaki korak ispisuje sto
# radi. Ponovno pokretanje je bezopasno: preskace ono sto vec postoji.
#
# Sto NE radi: ne postavlja MQTT tajne (ne generiraju se skriptom koja moze
# zavrsiti u logu) i ne trazi TLS certifikat. Oba koraka su na kraju, rucno.

set -euo pipefail

APLIKACIJA=/opt/xlamp-ng
KORISNIK=xlamp
BAZA=xlamp_ng
REPO="${1:-}"

korak() { echo; echo "==> $*"; }

if [[ $EUID -ne 0 ]]; then
  echo "Pokreni sa sudo." >&2
  exit 1
fi

if [[ -z "$REPO" ]]; then
  echo "Upotreba: sudo bash deploy/postavi.sh https://github.com/KORISNIK/REPO.git" >&2
  exit 1
fi

# ── Koji je ovo sustav ───────────────────────────────────────────────────────

if command -v apt-get >/dev/null; then
  OBITELJ=debian
elif command -v dnf >/dev/null; then
  OBITELJ=rhel
else
  echo "Ni apt-get ni dnf - nepodrzan sustav." >&2
  exit 1
fi

echo "Sustav: $(. /etc/os-release && echo "$PRETTY_NAME")  [$OBITELJ]"

# ── Paketi ───────────────────────────────────────────────────────────────────

korak "Instaliram pakete"

if [[ $OBITELJ == debian ]]; then
  apt-get update -qq
  apt-get install -y -qq git nginx postgresql postgresql-contrib
else
  # Bez curla: Amazon Linux dolazi s curl-minimal, a puni paket `curl` se s
  # njim izravno tuce i dnf odbije cijelu transakciju. curl je ionako vec tu.
  dnf install -y -q git nginx policycoreutils-python-utils

  # Amazon Linux nudi vise verzija Postgresa; uzima se najveca dostupna, jer se
  # dump napravljen novijim alatom ne da vratiti starijim posluziteljem.
  PG_PAKET=""
  for v in 17 16 15; do
    if dnf list --available "postgresql$v-server" &>/dev/null; then
      PG_PAKET="postgresql$v-server postgresql$v-contrib"
      break
    fi
  done
  [[ -z "$PG_PAKET" ]] && PG_PAKET="postgresql-server postgresql-contrib"
  echo "PostgreSQL paketi: $PG_PAKET"
  dnf install -y -q $PG_PAKET
fi

if ! command -v curl >/dev/null; then
  korak "Instaliram curl"
  if [[ $OBITELJ == debian ]]; then apt-get install -y -qq curl; else dnf install -y -q curl-minimal || dnf install -y -q curl; fi
fi

# Ubuntu i Amazon Linux u repozitorijima imaju stariji Node; aplikacija trazi 22+.
if ! command -v node >/dev/null || [[ "$(node -v | cut -c2- | cut -d. -f1)" -lt 22 ]]; then
  korak "Instaliram Node.js 22"
  if [[ $OBITELJ == debian ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
  else
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    dnf install -y -q nodejs
  fi
fi

echo "Node: $(node -v), npm: $(npm -v)"

# ── Swap ─────────────────────────────────────────────────────────────────────

# Angular build zna potrositi preko 1 GB. Na najjeftinijim instancama (t3.micro
# i slicne imaju 1 GB) proces bude ubijen bez jasne poruke - vidi se samo
# "Killed". Dvije gigabajta swapa to rjesava.
if ! swapon --show | grep -q .; then
  korak "Dodajem 2 GB swapa"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  echo "Swap vec postoji, preskacem."
fi

# ── Korisnik i direktorij ────────────────────────────────────────────────────

korak "Stvaram sistemskog korisnika i direktorij"
id -u "$KORISNIK" &>/dev/null || useradd --system --create-home --shell /usr/sbin/nologin "$KORISNIK"

if [[ -d "$APLIKACIJA/.git" ]]; then
  echo "Repozitorij vec postoji, povlacim promjene."
  # Neuspjeh ne smije srusiti deploy: kod je vec tu, a pull zna pasti iz razloga
  # koji s njim nemaju veze (privatan repozitorij bez vjerodajnica na
  # posluzitelju, mreza, istekao token). Tada se gradi ono sto je na disku.
  git -C "$APLIKACIJA" pull || echo "Pull nije uspio - nastavljam s postojecim kodom."
else
  git clone "$REPO" "$APLIKACIJA"
fi

# ── Baza ─────────────────────────────────────────────────────────────────────

korak "Postavljam PostgreSQL"

# Debian pri instalaciji sam napravi klaster; RHEL-obitelj ne - tamo se initdb
# poziva rucno i bez toga servis odbija start.
if [[ $OBITELJ == rhel && ! -f /var/lib/pgsql/data/PG_VERSION ]]; then
  echo "Inicijaliziram klaster."
  postgresql-setup --initdb
fi

systemctl enable --now postgresql

# Aplikacija se spaja preko TCP-a na localhost (DATABASE_URL), a zadani
# pg_hba.conf na RHEL-obitelji za host veze koristi "ident", koji za sistemskog
# korisnika ne postoji - veza bi bila odbijena, a poruka ne bi spominjala lozinku.
if [[ $OBITELJ == rhel ]]; then
  HBA=/var/lib/pgsql/data/pg_hba.conf
  if ! grep -qE '^host\s+all\s+all\s+127\.0\.0\.1/32\s+scram-sha-256' "$HBA"; then
    korak "Dopustam prijavu lozinkom na localhost"
    cp "$HBA" "$HBA.backup"
    sed -i -E 's|^(host[[:space:]]+all[[:space:]]+all[[:space:]]+127\.0\.0\.1/32[[:space:]]+).*|\1scram-sha-256|' "$HBA"
    sed -i -E 's|^(host[[:space:]]+all[[:space:]]+all[[:space:]]+::1/128[[:space:]]+).*|\1scram-sha-256|' "$HBA"
    systemctl reload postgresql
  fi
fi

# Lozinka se generira ovdje i odmah upisuje u .env; nigdje se ne ispisuje.
LOZINKA=$(openssl rand -base64 24 | tr -d '/+=' | head -c 28)

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$BAZA') THEN
    CREATE ROLE $BAZA LOGIN PASSWORD '$LOZINKA';
  ELSE
    ALTER ROLE $BAZA LOGIN PASSWORD '$LOZINKA';
  END IF;
END
\$\$;
SQL

sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$BAZA'" | grep -q 1 \
  || sudo -u postgres createdb -O "$BAZA" "$BAZA"

# ── .env ─────────────────────────────────────────────────────────────────────

korak "Pripremam .env"
ENV_PUT="$APLIKACIJA/backend/.env"

if [[ -f "$ENV_PUT" ]]; then
  echo "$ENV_PUT vec postoji - ne diram ga."
else
  cat > "$ENV_PUT" <<ENVEOF
DATABASE_URL="postgresql://$BAZA:$LOZINKA@localhost:5432/$BAZA?schema=public"

JWT_SECRET="$(openssl rand -hex 32)"
JWT_EXPIRES_IN="8h"

# ── POPUNI RUCNO prije pokretanja ────────────────────────────────────────────
MQTT_BROKER_URL=""
MQTT_APPLICATION_ID=""
# Mora se razlikovati od lokalnog i od produkcijske platforme na istom brokeru.
MQTT_CLIENT_ID="xlamp-ng-aws"

# Uredaji kojima se smije slati naredba, zarezom odvojeno. Prazno = onemoguceno.
ALLOWED_DEVEUIS=""

# Ostavi "true" dok ne provjeris tko sve ima pristup posluzitelju.
DOWNLINK_DRY_RUN="true"

PORT=3000
# Iza nginxa su frontend i API na istom porijeklu, pa preglednik nikad ne salje
# cross-origin zahtjev i ova vrijednost se u praksi ne koristi. Ipak se upisuje
# tocna adresa: ako se API ikad izlozi izravno, zvjezdica bi ga otvorila svima.
CORS_ORIGIN="http://localhost"
OFFLINE_AFTER_MINUTES=180
ENVEOF
  chmod 600 "$ENV_PUT"
  echo "Napravljen $ENV_PUT (lozinka baze i JWT kljuc su vec unutra)."
fi

# ── Build ────────────────────────────────────────────────────────────────────

korak "Gradim backend"
cd "$APLIKACIJA/backend"
npm ci --include=dev
npx prisma migrate deploy

korak "Gradim frontend"
cd "$APLIKACIJA/frontend"
npm ci
npm run build

# nginx sluzi iz frontend-dist, a Angular gradi u dist/frontend/browser.
rm -rf "$APLIKACIJA/frontend-dist"
cp -r "$APLIKACIJA/frontend/dist/frontend/browser" "$APLIKACIJA/frontend-dist"

chown -R "$KORISNIK:$KORISNIK" "$APLIKACIJA"

# ── systemd ──────────────────────────────────────────────────────────────────

korak "Postavljam systemd"
cp "$APLIKACIJA/deploy/xlamp-ng.service" /etc/systemd/system/
systemctl daemon-reload

# ── nginx ────────────────────────────────────────────────────────────────────

korak "Postavljam nginx"

if [[ $OBITELJ == debian ]]; then
  cp "$APLIKACIJA/deploy/nginx.conf" /etc/nginx/sites-available/xlamp-ng
  ln -sf /etc/nginx/sites-available/xlamp-ng /etc/nginx/sites-enabled/xlamp-ng
  rm -f /etc/nginx/sites-enabled/default
else
  # RHEL-obitelj nema sites-available; sve ide u conf.d.
  cp "$APLIKACIJA/deploy/nginx.conf" /etc/nginx/conf.d/xlamp-ng.conf

  # Zadani nginx.conf ovdje sadrzi vlastiti server blok. Uz nas su to dva
  # posluzitelja na portu 80 i zahtjevi zavrsavaju na nginx pozdravnoj stranici.
  # Blok se zakomentira, a original ostaje kao nginx.conf.backup.
  python3 - <<'PY'
import re, shutil

put = '/etc/nginx/nginx.conf'
s = open(put).read()

if '# xlamp: zakomentirano' in s:
    print('Zadani server blok je vec zakomentiran.')
else:
    m = re.search(r'^[ \t]*server[ \t]*\{', s, re.M)
    if not m:
        print('Nema zadanog server bloka, ne diram nista.')
    else:
        # Brojanje viticastih zagrada da se nade kraj bloka.
        i = m.start()
        j = m.end() - 1
        dubina = 0
        while j < len(s):
            if s[j] == '{':
                dubina += 1
            elif s[j] == '}':
                dubina -= 1
                if dubina == 0:
                    break
            j += 1
        blok = s[i:j + 1]
        shutil.copy(put, put + '.backup')
        zakomentiran = '\n'.join('#' + r for r in blok.split('\n'))
        s = s[:i] + '# xlamp: zakomentirano (dva server bloka na portu 80)\n' + zakomentiran + s[j + 1:]
        open(put, 'w').write(s)
        print('Zadani server blok zakomentiran, original u nginx.conf.backup')
PY

  # SELinux je na Amazon Linuxu ukljucen. Bez ovoga nginx dobije "Permission
  # denied" pri proxyju na Node (502) i pri citanju datoteka iz /opt (403) - a u
  # logu pise samo da je zabranjeno, ne i zasto.
  if command -v getenforce >/dev/null && [[ "$(getenforce)" != "Disabled" ]]; then
    korak "Podesavam SELinux"
    setsebool -P httpd_can_network_connect 1
    semanage fcontext -a -t httpd_sys_content_t "$APLIKACIJA/frontend-dist(/.*)?" 2>/dev/null || true
    restorecon -R "$APLIKACIJA/frontend-dist"
  fi
fi

nginx -t
systemctl enable --now nginx
systemctl reload nginx

cat <<'KRAJ'

════════════════════════════════════════════════════════════════════════════
 Ostalo je jos troje, rucno:

 1. Popuni u /opt/xlamp-ng/backend/.env:
      MQTT_BROKER_URL, MQTT_APPLICATION_ID, ALLOWED_DEVEUIS
      CORS_ORIGIN  -> http(s)://tvoja.domena

 2. Pokreni backend i napravi prvog administratora:
      sudo systemctl enable --now xlamp-ng
      sudo -u xlamp bash -c 'cd /opt/xlamp-ng/backend && npm run db:seed'

 3. HTTPS (treba domena koja se razrjesava):
      sudo dnf install -y certbot python3-certbot-nginx   # apt na Ubuntuu
      sudo certbot --nginx -d tvoja.domena

 Provjera:
      curl -s -H "Host: localhost" localhost/api/health
      journalctl -u xlamp-ng -f

 NE ZABORAVI: u AWS Security Group otvori ulazne portove 80 i 443.
════════════════════════════════════════════════════════════════════════════
KRAJ
