// Smoke test API-ja: prolazi kroz autentikaciju, scoping, validaciju, CRUD i
// whitelistu naredbi.
//
// Trazi POKRENUT poslužitelj i bazu sa seed podacima:
//   npm run dev:dry    (u drugom terminalu)
//   npm run test:smoke
//
// MORA ici uz `dev:dry`, ne uz `dev`. Test salje TURN_ON, TURN_OFF i
// SET_BRIGHTNESS lampama iz whiteliste, a to su stvarne svjetiljke u pogonu -
// protiv obicnog `dev` poslužitelja svako pokretanje testa upali i ugasi ulicu.
// Uz dry-run naredbe ostaju neposlane, pa i CRUD nad njima ima sto testirati.
//
// Test PISE u bazu i za sobom cisti ono sto je stvorio. Ne pokretati protiv
// baze u kojoj su podaci do kojih ti je stalo.

const BASE = 'http://localhost:3000/api';
let pass = 0, fail = 0;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204 */ }
  return { status: res.status, body: json };
}

function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  OK   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

// Brana, ne preporuka: bez ovoga bi jedno rasejano `npm run test:smoke` protiv
// obicnog poslužitelja ugasilo tri prave svjetiljke.
const health = await call('GET', '/health');
if (!health.body?.dryRun) {
  console.error(
    'PREKID: poslužitelj NIJE u dry-run nacinu.\n' +
      'Test salje TURN_ON/TURN_OFF/SET_BRIGHTNESS stvarnim svjetiljkama.\n' +
      'Pokreni poslužitelj s `npm run dev:dry` pa ponovi.',
  );
  process.exit(1);
}

const r = await call('POST', '/auth/login', { body: { username: 'admin', password: 'lozinka123' } });
check('login admin', r.status === 200 && r.body.token, JSON.stringify(r.body));
const admin = r.body.token;

const r2 = await call('POST', '/auth/login', { body: { username: 'ivica', password: 'lozinka123' } });
check('login ivica', r2.status === 200, JSON.stringify(r2.body));
const ivica = r2.body.token;

console.log('\n-- autentikacija --');
check('bez tokena -> 401', (await call('GET', '/lamps')).status === 401);
check('krivi token -> 401', (await call('GET', '/lamps', { token: 'smece' })).status === 401);
check('kriva lozinka -> 401', (await call('POST', '/auth/login', { body: { username: 'admin', password: 'x' } })).status === 401);
const me = await call('GET', '/auth/me', { token: ivica });
check('/auth/me vraca korisnika', me.body?.user?.username === 'ivica', JSON.stringify(me.body));

console.log('\n-- validacija --');
const kratka = await call('POST', '/auth/register', { body: { username: 'test1', email: 'a@b.c', password: 'kratka' } });
check('kratka lozinka -> 400', kratka.status === 400 && kratka.body.details?.password, JSON.stringify(kratka.body));
const zauzeto = await call('POST', '/auth/register', { body: { username: 'admin', email: 'novi@x.hr', password: 'lozinka12345' } });
check('zauzeto ime -> 409', zauzeto.status === 409, JSON.stringify(zauzeto.body));

console.log('\n-- lampe --');
const lampe = await call('GET', '/lamps', { token: ivica });
check('ivica vidi 3 lampe', lampe.body?.total === 3, JSON.stringify(lampe.body?.total));
// Konkretna vrijednost ovisi o tome je li lampa nedavno javila, pa se provjerava
// samo da je status jedan od dopustenih - inace test pada svaki put kad stigne
// pravi uplink.
const STATUSI = ['UNKNOWN', 'ONLINE', 'OFFLINE', 'ERROR'];
check('status je izveden', STATUSI.includes(lampe.body?.data?.[0]?.status), lampe.body?.data?.[0]?.status);

const nova = await call('POST', '/lamps', { token: admin, body: { name: 'Adminova', devEui: 'aaaaaaaaaaaaaaaa', latitude: 45.8, longitude: 15.9 } });
check('admin stvara lampu', nova.status === 201, JSON.stringify(nova.body));
const adminLampId = nova.body?.id;

const lampe2 = await call('GET', '/lamps', { token: ivica });
check('scoping: ivica NE vidi adminovu', lampe2.body?.total === 3, `vidi ${lampe2.body?.total}`);
check('scoping: ivica ne moze dohvatiti -> 404', (await call('GET', `/lamps/${adminLampId}`, { token: ivica })).status === 404);
check('scoping: ivica ne moze urediti -> 404', (await call('PUT', `/lamps/${adminLampId}`, { token: ivica, body: { name: 'ha' } })).status === 404);
check('scoping: ivica ne moze obrisati -> 404', (await call('DELETE', `/lamps/${adminLampId}`, { token: ivica })).status === 404);
check('admin vidi sve 4', (await call('GET', '/lamps', { token: admin })).body?.total === 4);

const losEui = await call('POST', '/lamps', { token: ivica, body: { name: 'x', devEui: 'nijehex', latitude: 45, longitude: 15 } });
check('neispravan devEUI -> 400', losEui.status === 400, JSON.stringify(losEui.body));
const dupli = await call('POST', '/lamps', { token: ivica, body: { name: 'x', devEui: '8cf95720001e223d', latitude: 45, longitude: 15 } });
check('dupli devEUI -> 409', dupli.status === 409, JSON.stringify(dupli.body));

console.log('\n-- korisnici --');
check('ivica ne vidi popis -> 403', (await call('GET', '/users', { token: ivica })).status === 403);
check('admin vidi popis', (await call('GET', '/users', { token: admin })).body?.total >= 2);
const eskalacija = await call('PUT', `/users/${me.body.user.id}`, { token: ivica, body: { role: 'ADMIN' } });
check('ivica si ne moze dati ADMIN -> 403', eskalacija.status === 403, JSON.stringify(eskalacija.body));
check('ivica ne moze citati tudi profil -> 403', (await call('GET', '/users/1', { token: ivica })).status === 403);

console.log('\n-- naredbe --');
const mojaLampa = lampe.body.data[0];
const dl = await call('POST', '/downlinks', { token: ivica, body: { lampId: mojaLampa.id, command: 'TURN_ON' } });
check('TURN_ON prihvacen', dl.status === 201, JSON.stringify(dl.body));
check('TURN_ON payload=03 port=10', dl.body?.payload === '03' && dl.body?.port === 10, `${dl.body?.payload}/${dl.body?.port}`);

const sb = await call('POST', '/downlinks', { token: ivica, body: { lampId: mojaLampa.id, command: 'SET_BRIGHTNESS', argument: 50 } });
check('SET_BRIGHTNESS 50% -> 017f', sb.body?.payload === '017f', sb.body?.payload);
const rs = await call('POST', '/downlinks', { token: ivica, body: { lampId: mojaLampa.id, command: 'REQUEST_STATUS' } });
check('REQUEST_STATUS payload=01 port=30', rs.body?.payload === '01' && rs.body?.port === 30, `${rs.body?.payload}/${rs.body?.port}`);
const re = await call('POST', '/downlinks', { token: ivica, body: { lampId: mojaLampa.id, command: 'REQUEST_ENERGY' } });
check('REQUEST_ENERGY payload=02 port=30', re.body?.payload === '02' && re.body?.port === 30, `${re.body?.payload}/${re.body?.port}`);

const bezArg = await call('POST', '/downlinks', { token: ivica, body: { lampId: mojaLampa.id, command: 'SET_BRIGHTNESS' } });
check('SET_BRIGHTNESS bez argumenta -> 400', bezArg.status === 400, JSON.stringify(bezArg.body));
const preveliko = await call('POST', '/downlinks', { token: ivica, body: { lampId: mojaLampa.id, command: 'SET_BRIGHTNESS', argument: 150 } });
check('svjetlina 150% -> 400', preveliko.status === 400);
const nepoznata = await call('POST', '/downlinks', { token: ivica, body: { lampId: mojaLampa.id, command: 'SELF_DESTRUCT' } });
check('nepoznata naredba -> 400', nepoznata.status === 400);

console.log('\n-- WHITELIST --');
const zabranjeno = await call('POST', '/downlinks', { token: admin, body: { lampId: adminLampId, command: 'TURN_OFF' } });
check('lampa izvan whiteliste -> 403', zabranjeno.status === 403, JSON.stringify(zabranjeno.body));

console.log('\n-- izmjena i brisanje naredbi --');
const izmjena = await call('PUT', `/downlinks/${dl.body.id}`, { token: ivica, body: { command: 'TURN_OFF' } });
check('neposlana naredba se moze urediti', izmjena.status === 200 && izmjena.body?.payload === '02', JSON.stringify(izmjena.body));
const otkaz = await call('POST', `/downlinks/${sb.body.id}/cancel`, { token: ivica });
check('otkazivanje radi', otkaz.status === 200 && otkaz.body?.cancelled === true, JSON.stringify(otkaz.body));
check('dvostruko otkazivanje -> 409', (await call('POST', `/downlinks/${sb.body.id}/cancel`, { token: ivica })).status === 409);
check('brisanje otkazane -> 409', (await call('DELETE', `/downlinks/${sb.body.id}`, { token: ivica })).status === 409);
check('brisanje neposlane radi', (await call('DELETE', `/downlinks/${rs.body.id}`, { token: ivica })).status === 204);

console.log('\n-- ciscenje --');
check('admin brise svoju lampu', (await call('DELETE', `/lamps/${adminLampId}`, { token: admin })).status === 204);
const ostatak = await call('GET', '/downlinks', { token: ivica });
for (const d of ostatak.body.data) await call('DELETE', `/downlinks/${d.id}`, { token: admin });

// Neprijavljen korisnik dobiva 401 i na nepostojecoj ruti - requireAuth stoji
// ispred svega. To je namjerno: 404 bi mu rekao koje rute postoje, a koje ne.
check('nepoznata ruta bez tokena -> 401', (await call('GET', '/nema-me')).status === 401);
check('nepoznata ruta s tokenom -> 404', (await call('GET', '/nema-me', { token: admin })).status === 404);

console.log(`\n=== ${pass} proslo, ${fail} palo ===`);
process.exit(fail ? 1 : 0);
