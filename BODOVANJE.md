# Gdje je što od bodovnog lista

Popis stavki iz `ZahtjeviProjekata2025` i gdje se svaka nalazi u aplikaciji.

Aplikacija: **X-lamp**, nadzor i daljinsko upravljanje javnom rasvjetom preko
LoRaWAN mreže. Uređaji na svjetiljkama šalju telemetriju i primaju naredbe preko
ChirpStack poslužitelja.

Opcija: Angular + Node.js (45 bodova).

Živa verzija: **https://isrdojevi-nap-jvs-prog.duckdns.org**

---

## Model podataka u bazi — 3 boda

Četiri tablice, tri od njih nisu korisnici.

| Entitet | Što je |
|---|---|
| `Lamp` | svjetiljka, `devEui` je jedinstveni ključ modema |
| `Uplink` | telemetrija s uređaja, čuva se sirovi payload |
| `Downlink` | naredba prema uređaju |
| `User` | korisnik, uloga `USER` ili `ADMIN` |

Shema je u `backend/prisma/schema.prisma`.

Tipovi: koordinate su `Float`, svjetlina je `Int?` jer `null` znači "nije se još
javila" (nije isto što i 0 %). Tri enumeracije za status, ulogu i vrstu naredbe.

Veze: lampa ima vlasnika, uplink i downlink pripadaju lampi, downlink pamti tko
ga je poslao. Brisanje korisnika briše i njegove lampe.

Za pregled: `cd backend && npm run db:studio`.

---

## Angular Routing — 2 boda

| Ruta | Ekran |
|---|---|
| `/prijava`, `/registracija` | javno |
| `/lampe` | popis |
| `/lampe/:id` | **ruta s parametrom**, detalj svjetiljke |
| `/karta` | Leaflet karta |
| `/telemetrija` | pristigle poruke |
| `/naredbe` | slanje i povijest |
| `/korisnici` | administracija |

Glavni izbornik je bočna navigacija. Rute su lijene, ekran se dohvaća tek kad se
otvori.

Ruta s parametrom je detalj svjetiljke, otvara se klikom na naziv u popisu.
`/lampe/999` javi da ne postoji, `/lampe/abc` vraća na popis.

---

## CRUD operacije nad svim entitetima — 10 bodova

| Entitet | Čitanje | Unos | Izmjena | Brisanje |
|---|---|---|---|---|
| Lamp | da | da | da | da |
| Downlink | da | da | dok nije poslana | dok nije poslana |
| User | da | da | da | da |
| Uplink | da | preko MQTT-a | — | da |

Uplink nema obrazac za ručni unos jer nastaje kad uređaj pošalje poruku. Obrazac
"dodaj telemetriju" značio bi izmišljanje očitanja senzora.

Naredba se može mijenjati i brisati samo dok nije poslana. Poslani LoRaWAN okvir
se ne može opozvati. Gumb "Uredi" učita naredbu natrag u obrazac; spremanje
briše stari red i stvara novi, pa nova naredba prolazi istu provjeru payloada i
whiteliste. Postoji i "otkaži", koje red označi umjesto da ga makne.

Validacija je Angular Reactive Forms, poruka se pokaže ispod polja:

- prijava i registracija: obavezna polja, duljina lozinke, podudaranje
- svjetiljka: devEUI mora biti 16 hex znamenki
- korisnik: format imena, e-mail, duljina lozinke
- naredba: svjetlina 0-100

Poslužitelj istu provjeru ponavlja preko zod shema.

---

## Autorizacija i autentikacija — 7 bodova

| Traži se | Gdje |
|---|---|
| Greške pri loginu | ekran prijave, obrazac ostaje popunjen |
| Hashiranje lozinki | bcrypt, 10 rundi |
| Registracija | `/registracija` |
| Razine prava | `USER` i `ADMIN` |
| Token | JWT, vrijedi 8 sati |

Prava su provedena na tri mjesta:

1. sučelje ne nudi gumbe za ono što korisnik ne smije
2. API filtrira svaki upit po vlasniku
3. Socket.IO šalje telemetriju samo vlasniku i administratorima

Treće je važno. Da WebSocket emitira svima, filtriranje na REST-u ne bi vrijedilo
ništa.

Obični korisnik vidi samo vlastite svjetiljke i vlastiti profil. Ne može sebi
promijeniti ulogu; poslužitelj to odbija i kad se zahtjev pošalje ručno.

Token ide u zaglavlju `Authorization: Bearer`. Angular ga dodaje kroz
interceptor, a istekli token odjavljuje korisnika.

---

## Pipeovi i servisi — 3 boda

Sedam servisa u `frontend/src/app/core/`: auth, lamp, uplink, downlink, user,
realtime, system. Komponente ne zovu `HttpClient` izravno.

| Pipe | Radi |
|---|---|
| `brightness` | `42` u `42 %`, `null` u `—` |
| `signalQuality` | `-58` u `Odličan (-58 dBm)` |
| `lastSeen` | vremenska oznaka u `prije 12 min` |
| `uplinkSummary` | dekodirana poruka u jedan redak |

Servis `mqtt.js` na poslužitelju drži trajnu pretplatu na ChirpStack: prima
uplinkove, dekodira ih i sprema, a naredbe objavljuje natrag.

---

## Server, RESTful API — 10 bodova

```
POST   /api/auth/register          javno
POST   /api/auth/login             javno
GET    /api/auth/me

GET    /api/lamps                  pretraga i straničenje
POST   /api/lamps
GET    /api/lamps/:id
PUT    /api/lamps/:id
DELETE /api/lamps/:id

GET    /api/uplinks                filtar po lampi
GET    /api/uplinks/:id
DELETE /api/uplinks/:id

GET    /api/downlinks
POST   /api/downlinks
GET    /api/downlinks/:id
PUT    /api/downlinks/:id
DELETE /api/downlinks/:id
POST   /api/downlinks/:id/cancel

GET    /api/users                  admin
POST   /api/users                  admin
GET    /api/users/:id
PUT    /api/users/:id
DELETE /api/users/:id              admin
```

Statusi: 201 stvoreno, 204 obrisano, 401 bez tokena, 403 bez prava, 404 ne
postoji, 409 sukob (npr. izmjena poslane naredbe).

Zaštita je postavljena na jednom mjestu, u `routes/index.js`. Token traže sve
rute osim prijave, registracije i `/api/health`, koji je namjerno javan da
poslužitelj može javiti radi li.

### Provjera iz terminala

Bodovni list ovdje traži dohvat i CRUD **putem API-ja**, odvojeno od stavke koja
isto traži kroz sučelje. Naredbe dolje poredane su tako da svaka pokriva jednu
podstavku.

Pokreću se u Git Bashu. U PowerShellu je `curl` alias za `Invoke-WebRequest` pa
sintaksa ne prolazi, tamo treba `curl.exe`. Dio `| python -m json.tool` samo
uljepšava ispis i može se izostaviti.

```bash
API=https://isrdojevi-nap-jvs-prog.duckdns.org/api
```

Isti niz radi i nad lokalno pokrenutom kopijom, treba samo zamijeniti adresu. Uz
`npm run dev:dry` naredbe se tada zapisuju u bazu, ali se ne šalju uređajima:

```bash
API=http://localhost:3000/api
```

**Zaštićen pristup pomoću tokena**

```bash
curl -i -s $API/lamps | head -1
```

Vraća `401` jer nema tokena. Lozinka se učitava upitom, da se ne ispiše na ekran:

```bash
read -s -p "Lozinka: " LOZ; echo
```

```bash
TOKEN=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"$LOZ\"}" | python -c "import sys,json; print(json.load(sys.stdin)['token'])")
```

```bash
curl -s $API/auth/me -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Dohvat svih entiteta**

```bash
curl -s "$API/lamps?page=1&pageSize=2" -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

```bash
curl -s "$API/uplinks?lampId=1&pageSize=3" -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

```bash
curl -s $API/downlinks -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

```bash
curl -s $API/users -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Ruta s parametrom**

```bash
curl -s $API/lamps/1 -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Unos, izmjena i brisanje putem API-ja**

```bash
curl -i -s -X POST $API/lamps -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Nova svjetiljka","devEui":"8cf9572000100001","latitude":45.8,"longitude":15.98}'
```

Odgovor je `201 Created`. Iz njega se pročita `id` i upiše u iduće tri naredbe
umjesto broja `4`.

Prije nego se pokrene izmjena ili brisanje, provjeri da je `id` doista onaj iz
odgovora. Svjetiljke `1`, `2` i `3` su stvarne, imaju povijest telemetrije i
brisanje ih odnosi zajedno s njom. Ako se ovaj dio radi nad produkcijom, sigurnije
je najprije prebaciti `API` na lokalnu adresu.

```bash
curl -s -X PUT $API/lamps/4 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Preimenovana","devEui":"8cf9572000100001","latitude":45.81,"longitude":15.99}' | python -m json.tool
```

```bash
curl -i -s -X DELETE $API/lamps/4 -H "Authorization: Bearer $TOKEN" | head -1
```

`204 No Content`, a idući dohvat istog id-a vraća `404`:

```bash
curl -i -s $API/lamps/4 -H "Authorization: Bearer $TOKEN" | head -1
```

**Validacija i razine prava**

```bash
curl -s -X POST $API/lamps -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"X","devEui":"abc","latitude":45,"longitude":15}' | python -m json.tool
```

`400` s porukom da devEUI mora imati 16 heksadekadskih znamenki, ista provjera koju
radi i Angular obrazac.

```bash
read -s -p "Lozinka za ivica: " LOZ2; echo
```

```bash
UT=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d "{\"username\":\"ivica\",\"password\":\"$LOZ2\"}" | python -c "import sys,json; print(json.load(sys.stdin)['token'])")
```

```bash
curl -s $API/users -H "Authorization: Bearer $UT" | python -m json.tool
```

`403`, obični korisnik ne smije na popis korisnika.

**Naredba stvarnom uređaju**

```bash
curl -s -X POST $API/downlinks -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"lampId":1,"command":"TURN_ON"}' | python -m json.tool
```

U odgovoru su `"payload":"03"`, `"port":10` i `"isSent":true`. Svjetlina ide s
argumentom:

```bash
curl -s -X POST $API/downlinks -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"lampId":1,"command":"SET_BRIGHTNESS","argument":40}' | python -m json.tool
```

Odgovor uređaja stiže za nekoliko sekundi i vidi se kao novi uplink:

```bash
curl -s "$API/uplinks?lampId=1&pageSize=3" -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

---

## Korisničko sučelje — 2 boda

Bootstrap 5.3. Koriste se `card`, `btn`, `table`, `modal`, `form-control`,
`badge` i grid. Paleta projekta je preslikana na Bootstrapove CSS varijable u
`frontend/src/styles.scss`.

Responzivno je. Ispod 768 px bočna traka se skupi na ikone, tablice dobiju
vodoravni klizač.

Brisanje traži potvrdu. Naredbe koje pale ili gase svjetiljku traže drugi klik s
imenom svjetiljke u poruci.

---

## Struktura projekta — 2 boda

```
backend/
  prisma/           shema, migracije, seed
  scripts/          izvoz baze
  tests/            smoke test
  src/
    routes/         REST rute
    controllers/    logika
    middleware/     JWT, greske
    services/       MQTT, naredbe, Socket.IO
    lib/            kodek, konfiguracija, status
frontend/
  src/app/
    core/           servisi, interceptor, guardovi
    pipes/          custom pipeovi
    layout/shell/   navigacija
    pages/          ekrani
deploy/             nginx, systemd, skripte
```

Rute mapiraju URL na kontroler, kontroleri ne znaju za MQTT, servisi ne znaju za
HTTP.

`.env` nije u repozitoriju, samo `.env.example`.

---

## Subjektivan dojam — 3 boda

Aplikacija radi sa stvarnom opremom, ne s izmišljenim podacima. Uređaji na
svjetiljkama javljaju telemetriju preko LoRaWAN mreže, a aplikacija ih pali, gasi
i prigušuje.

Najzahtjevniji dio je dekodiranje payloada u `backend/src/lib/codec.js`. Iz
heksadekadskog niza vadi svjetlinu, temperaturu, profil i kvalitetu veze.
Energetska poruka nosi do 13 parametara koje bira bitovna maska, svaki sa svojom
mantisom i eksponentom. Koji su prisutni ovisi o postavkama uređaja, pa se moraju
čitati redom.

Telemetrija ide na sučelje uživo preko Socket.IO-a, s istim pravima kao REST.

---

## Predaja — 3 boda

| Traži se | Gdje |
|---|---|
| Video | prilaže se odvojeno |
| Export baze | `backend/backup/xlamp_ng.sql` |
| Upute za pokretanje | `README.md` |
| Bez grešaka u konzoli | provjereno na svim ekranima |

Backend ima 39 smoke testova koji prolaze kroz cijeli API (prijava, prava, CRUD,
rubni slučajevi). Traže pokrenut poslužitelj u dry-run načinu, pa idu u dva
terminala:

```bash
cd backend
npm run dev:dry
```

```bash
cd backend
npm run test:smoke
```

Frontend ima 10 unit testova nad pipeovima:

```bash
cd frontend
npm test
```

Izvoz baze radi `npm run db:export` u direktoriju `backend`. Skripta sama nalazi
`pg_dump` (na Windowsu nije na PATH-u) i pravi dump bez vlasništva i prava, pa se
uvozi pod bilo kojim korisnikom:

```bash
psql -U postgres -d xlamp_ng -f backend/backup/xlamp_ng.sql
```

---

## Dodatni bodovi

### Vanjski API — 2 boda

| Servis | Što se koristi |
|---|---|
| ChirpStack | MQTT API, telemetrija i naredbe |
| OpenStreetMap | slojevi karte preko Leafleta |

ChirpStack nije demo API nego stvarni LoRaWAN poslužitelj s uređajima na
svjetiljkama. Aplikacija se pretplaćuje na
`application/{appId}/device/+/event/+` i objavljuje naredbe na
`.../command/down`.

### Postavljanje online — 2 boda

Aplikacija je na AWS EC2 (Amazon Linux 2023), HTTPS preko Let's Encrypta.
Postavljanje je skriptirano: `deploy/postavi.sh`, `nginx.conf` i systemd
jedinica.

nginx služi Angular build i proxyja `/api` i `/socket.io` na Node. PostgreSQL je
na istom stroju.

Odabran je vlastiti poslužitelj jer backend drži trajnu MQTT pretplatu.
Serverless platforme gase funkciju nakon odgovora, a besplatni PaaS planovi
uspavaju instancu nakon petnaestak minuta, pa se telemetrija u tom razdoblju
gubi.

---

## Sigurnosna ograda

Naredbe idu stvarnim svjetiljkama, a LoRaWAN nema opoziv poslanog okvira. Zato
postoje dvije brane:

- `ALLOWED_DEVEUIS` je popis uređaja kojima se smije slati. Prazan popis znači da
  je slanje isključeno. Provjera je u servisu, ne u kontroleru.
- `DOWNLINK_DRY_RUN` zapisuje naredbe u bazu bez slanja na broker. Koristi se za
  testiranje.
