# X-lamp — sustav za upravljanje javnom rasvjetom

Projektni zadatak iz kolegija Napredno JavaScript programiranje.

Web aplikacija za nadzor i upravljanje LoRaWAN uređajima montiranima na svjetiljke
javne rasvjete. Uređaji preko LoRaWAN mreže i ChirpStack poslužitelja šalju
telemetriju (uplink) i primaju naredbe (downlink).

**Aplikacija radi na:** https://isrdojevi-nap-jvs-prog.duckdns.org
Pristupni podaci poslani su e-mailom.

Popis stavki bodovnog lista i gdje se svaka nalazi: [BODOVANJE.md](BODOVANJE.md)

---

# Pokretanje lokalno

Preduvjeti: **Node.js 22+** i **PostgreSQL**. Angular CLI nije potrebno instalirati
globalno jer `npm start` koristi lokalnu kopiju.

### 1. Stvaranje baze

**Windows.** Nakon standardne instalacije PostgreSQL-a `createdb` i `psql` **nisu na
PATH-u**, pa naredba javlja da nije prepoznata. Postoje dvije mogućnosti:

*a) Kroz pgAdmin* (instalira se zajedno s PostgreSQL-om): desni klik na **Databases**
→ *Create* → *Database*, ime `xlamp_ng`.

*b) Punom putanjom* u cmd-u ili PowerShellu (broj verzije prilagoditi ako nije 18):

```
"C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres xlamp_ng
```

Naredba traži lozinku korisnika `postgres`, onu postavljenu pri instalaciji
PostgreSQL-a.

Za češće korištenje alata mogu se dodati na PATH za tu sesiju (PowerShell):

```
$env:PATH = "C:\Program Files\PostgreSQL\18\bin;$env:PATH"
```

Nakon toga `createdb`, `psql` i `pg_dump` rade bez pune putanje.

**Linux i macOS:**

```bash
createdb -U postgres xlamp_ng
```

### 2. Kopiranje predloška konfiguracije

Windows:

```bash
copy backend\.env.example backend\.env
```

Linux i macOS:

```bash
cp backend/.env.example backend/.env
```

### 3. Popunjavanje `.env`

U datoteci `backend/.env` potrebno je postaviti dvije vrijednosti:

```
DATABASE_URL="postgresql://postgres:LOZINKA@localhost:5432/xlamp_ng?schema=public"
JWT_SECRET="bilo-kakav-niz-od-najmanje-32-znaka-npr-ovaj-ovdje"
```

Ostalo ostaje kako jest. Adrese brokera su namjerno **prazne** i takve trebaju
ostati za lokalno pokretanje. Aplikacija tada radi u cijelosti, samo ne prima
telemetriju sa stvarnih uređaja:

```
MQTT_BROKER_URL=""
MQTT_APPLICATION_ID=""
```

`ALLOWED_DEVEUIS` iz predloška **ostavi kako jest**. To je popis uređaja kojima se
naredba smije poslati, a u predlošku su tri adrese koje stvara seed. Ako se
isprazni, svaki pokušaj slanja vraća 403 i ekran Naredbe se ne može isprobati.

Podaci za spajanje na stvarnu LoRaWAN mrežu poslani su e-mailom.

### 4. Instalacija i priprema baze

```bash
cd backend
npm ci
npx prisma migrate deploy
npm run db:seed
```

### 5. Pokretanje backenda

```bash
npm run dev:dry
```

Sluša na `http://localhost:3000`. `dev:dry` znači da se naredbe zapisuju u bazu, ali
se **ne šalju** stvarnim svjetiljkama. Za stvarno slanje koristi se `npm run dev`.

### 6. Pokretanje frontenda

U **drugom** terminalu:

```bash
cd frontend
npm ci
npm start
```

Aplikacija je na `http://localhost:4200`.

### 7. Prijava

| Korisnik | Lozinka | Uloga |
|---|---|---|
| `admin` | `lozinka123` | administrator, vidi sve |
| `ivica` | `lozinka123` | obični korisnik, vidi samo svoje svjetiljke |

Seed stvara i tri svjetiljke, koje pripadaju korisniku `ivica`.

### Umjesto seeda: uvoz gotove baze

U `backend/backup/xlamp_ng.sql` nalazi se izvoz baze s pravim podacima: tri
svjetiljke, telemetrija sa stvarnih uređaja i povijest naredbi. Za korištenje tih
podataka umjesto praznih tablica **preskače se korak `npm run db:seed`**, a dump se
uvozi ovako:

```bash
psql -U postgres -d xlamp_ng -f backend/backup/xlamp_ng.sql
```

Na Windowsu punom putanjom, ako `psql` nije na PATH-u:

```
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d xlamp_ng -f backend\backup\xlamp_ng.sql
```

Dump sadrži i strukturu i podatke, pa `npx prisma migrate deploy` iz koraka 4 nije
nužan. Ne smeta ako je već pokrenut, jer dump prvo briše postojeće tablice pa ih
stvara iznova.

Korisnici i lozinke isti su kao u tablici gore.

---

## Tehnologije

| Sloj | Tehnologija |
|---|---|
| Frontend | Angular 21 + Bootstrap 5 |
| Backend | Node.js 22 + Express |
| Baza | PostgreSQL + Prisma ORM |
| Real-time | Socket.IO |
| LoRaWAN | ChirpStack preko MQTT-a |

## Struktura

```
├── backend/            REST API + MQTT most prema ChirpStacku
│   ├── prisma/         shema baze, migracije, seed
│   ├── scripts/        izvoz baze
│   ├── tests/          smoke test
│   └── src/
│       ├── routes/         definicije REST ruta
│       ├── controllers/    logika ruta
│       ├── middleware/     JWT autentikacija i autorizacija
│       ├── services/       MQTT klijent, slanje naredbi, Socket.IO
│       └── lib/            kodiranje i dekodiranje payloada
├── frontend/           Angular aplikacija
│   └── src/app/
│       ├── core/           servisi, JWT interceptor, guardovi
│       ├── pipes/          custom pipeovi
│       ├── layout/shell/   bočna navigacija
│       └── pages/          po jedan direktorij za svaki ekran
└── deploy/             nginx, systemd, skripta za postavljanje
```

## Ekrani

| Ruta | Sadržaj |
|---|---|
| `/prijava`, `/registracija` | prijava i registracija s validacijom |
| `/lampe` | popis svjetiljki, CRUD, pretraga, straničenje |
| `/lampe/:id` | detalj jedne svjetiljke: stanje, upravljanje, povijest |
| `/karta` | Leaflet karta s oznakama obojenim po stanju |
| `/telemetrija` | živa telemetrija s dekodiranim porukama |
| `/naredbe` | slanje naredbi i povijest s izmjenom i otkazivanjem |
| `/korisnici` | administratoru svi korisnici, ostalima vlastiti profil |

## Pipeovi

| Pipe | Pretvara |
|---|---|
| `brightness` | `42` → `42 %`, a `null` → `—` (nije isto što i 0 %) |
| `signalQuality` | `-58` → `Odličan (-58 dBm)` |
| `lastSeen` | vremensku oznaku → `prije 12 min` |
| `uplinkSummary` | dekodiranu poruku → jedan redak za tablicu |

## Model podataka

- **User** — korisnici s ulogom `USER` ili `ADMIN`
- **Lamp** — svjetiljka; `devEui` je jedinstveni ključ modema na mreži
- **Uplink** — telemetrija pristigla s uređaja (sirovi payload)
- **Downlink** — naredba prema uređaju, s praćenjem je li poslana

## Komunikacija s uređajima

Ide preko MQTT-a, ne preko REST API-ja. ChirpStack objavljuje događaje na broker, a
naredbe se šalju objavom na temu uređaja.

| Smjer | Tema |
|---|---|
| Telemetrija | `application/{appId}/device/+/event/+` |
| Naredbe | `application/{appId}/device/{devEUI}/command/down` |

| Naredba | Payload | Port |
|---|---|---|
| `TURN_ON` | `03` | 10 |
| `TURN_OFF` | `02` | 10 |
| `SET_BRIGHTNESS` | `01` + bajt | 10 |
| `REQUEST_STATUS` | `01` | 30 |
| `REQUEST_ENERGY` | `02` | 30 |

| Uplink | Sadržaj |
|---|---|
| `01` | status — svjetlina, profil, temperatura, RSSI/SNR |
| `02` | energija — do 13 parametara po bitovnoj maski |
| `03` | alarm — bitovi grešaka (DALI, RTC, interna) |
| `04` | boot — verzija firmwarea, trajanje noći, stanje |

Pristigli uplink se dekodira, sprema i odmah gura na frontend preko Socket.IO-a.
Klijent se na socket autenticira istim JWT-om kao i na REST, a događaj o lampi dobiva
samo njezin vlasnik i administratori.

## Vanjski servisi

| Servis | Što se koristi |
|---|---|
| ChirpStack | MQTT API mrežnog poslužitelja: telemetrija i slanje naredbi |
| OpenStreetMap | slojevi karte preko Leafleta |

## Sigurnosne napomene

`ALLOWED_DEVEUIS` je popis uređaja kojima se smije slati naredba. Uređaj koji nije na
popisu ne može primiti downlink. Razlog: naredbe se šalju stvarnim svjetiljkama, a
LoRaWAN nema opoziv poslanog okvira. Provjera vrijedi uvijek, pa i kad je
`DOWNLINK_DRY_RUN` uključen.

`DOWNLINK_DRY_RUN="true"` zapisuje naredbe u bazu bez slanja na broker.
