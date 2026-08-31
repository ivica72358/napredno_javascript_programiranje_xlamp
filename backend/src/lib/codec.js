// kodiranje naredbi i dekodiranje telemetrije za X-lamp LoRaWAN uredaje

// 
// ─────────────────────────────────────────────────────────────────────────────

/// LoRaWAN fPort na kojem uredaj ocekuje naredbe upravljanja svjetlom
const PORT_CONTROL = 10;
/// fPort za zahtjeve "posalji mi poruku odmah"
const PORT_REQUEST = 30;

/// uredaj svjetlinu prima kao bajt 0-255, a korisnik je zadaje u postocima
const BRIGHTNESS_SCALE = 2.55;

// opcode 01 na portu 10 znaci "postavi svjetlinu", a isti opcode na portu 30
// znaci "posalji status"
const COMMANDS = {
  TURN_ON: { payload: '03', port: PORT_CONTROL },
  TURN_OFF: { payload: '02', port: PORT_CONTROL },
  REQUEST_STATUS: { payload: '01', port: PORT_REQUEST },
  REQUEST_ENERGY: { payload: '02', port: PORT_REQUEST },
  // SET_BRIGHTNESS se racuna, vidi encodeCommand()
};

export const COMMAND_TYPES = [...Object.keys(COMMANDS), 'SET_BRIGHTNESS'];

/**
 * Pretvara naredbu u hex payload i LoRaWAN port.
 * @param {string} command - vrijednost CommandType enuma
 * @param {number|null} argument - postotak 0-100, samo za SET_BRIGHTNESS
 * @returns {{payload: string, port: number}}
 */
export function encodeCommand(command, argument = null) {
  if (command === 'SET_BRIGHTNESS') {
    if (!Number.isInteger(argument) || argument < 0 || argument > 100) {
      throw new Error('Svjetlina mora biti cijeli broj izmedu 0 i 100.');
    }
    // zaokruzivanje prema dolje, kao u produkciji: 50 % -> 127, ne 128
    const byte = Math.floor(argument * BRIGHTNESS_SCALE);
    return { payload: '01' + byte.toString(16).padStart(2, '0'), port: PORT_CONTROL };
  }

  const spec = COMMANDS[command];
  if (!spec) throw new Error(`Nepoznata naredba: ${command}`);
  return { ...spec };
}

// 
// ─────────────────────────────────────────────────────────────────────────────

export function hexToBase64(hex) {
  return Buffer.from(hex, 'hex').toString('base64');
}

export function base64ToHex(b64) {
  return Buffer.from(b64, 'base64').toString('hex');
}

/// bajt kao predznacen cijeli broj (-128..127)
function signedByte(hex) {
  const v = parseInt(hex, 16);
  return v > 127 ? v - 256 : v;
}

/// sekunde u "5d 4h 12m" - citljivije od golemog broja sekundi u tablici
function formatDuration(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}

/// unix timestamp iz 4 bajta hexa
function readTimestamp(hex) {
  return new Date(parseInt(hex, 16) * 1000);
}

/// bajt svjetline (0-255) u postotak
function brightnessPercent(hex) {
  return Math.round(parseInt(hex, 16) / BRIGHTNESS_SCALE);
}

// 
// ─────────────────────────────────────────────────────────────────────────────

/// bitovi u alarmnoj poruci (tip 03)
const ALARM_BITS = [
  'Greska na DALI sabirnici',
  'Interna greska',
  'RTC nije podesen, a potreban je za ABS profil',
  'RTC nije podesen, dostupan je zamjenski DUR profil',
];

/// redoslijed parametara u energetskoj poruci (tip 02)
const ENERGY_PARAMS = [
  { key: 'apparentPower', label: 'Prividna snaga', unit: 'VA', size: 8, scaled: true },
  { key: 'apparentEnergy', label: 'Prividna energija', unit: 'VAh', size: 8, scaled: true },
  { key: 'activePower', label: 'Radna snaga', unit: 'W', size: 8, scaled: true },
  { key: 'activeEnergy', label: 'Radna energija', unit: 'Wh', size: 8, scaled: true },
  { key: 'loadsidePower', label: 'Snaga na trosilu', unit: 'W', size: 8, scaled: true },
  { key: 'loadsideEnergy', label: 'Energija na trosilu', unit: 'Wh', size: 8, scaled: true },
  { key: 'powerFactor', label: 'Faktor snage', unit: '%', size: 2 },
  { key: 'supplyVoltage', label: 'Napon napajanja', unit: 'Vrms', size: 4, div: 10 },
  { key: 'lightSourceVoltage', label: 'Napon izvora svjetla', unit: 'V', size: 4, div: 10 },
  { key: 'lightSourceCurrent', label: 'Struja izvora svjetla', unit: 'mA', size: 4 },
  { key: 'lightSourceTotalOnTime', label: 'Ukupno vrijeme rada izvora', duration: true, size: 8 },
  { key: 'lightSourceOnTimeSincePowerOn', label: 'Vrijeme rada od ukljucenja', duration: true, size: 8 },
  { key: 'controlGearTotalOperatingTime', label: 'Ukupno vrijeme rada predspojne naprave', duration: true, size: 8 },
];

/// vrijednost zapisana kao 3 bajta mantise + predznacen eksponent baze 10
function scaledValue(hex) {
  const mantissa = parseInt(hex.slice(0, 6), 16);
  const exponent = signedByte(hex.slice(6, 8));
  return Math.round(mantissa * 10 ** exponent * 100) / 100;
}

function decodeStatus(payload) {
  // temperatura dolazi s pomakom +60
  const temperature = parseInt(payload.slice(16, 18), 16) - 60;

  return {
    type: 'STATUS',
    label: 'Status poruka',
    deviceTime: readTimestamp(payload.slice(2, 10)),
    daliStatus: parseInt(payload.slice(10, 12), 16),
    brightness: brightnessPercent(payload.slice(12, 14)),
    profileIndex: parseInt(payload.slice(14, 16), 16),
    temperature: temperature < -50 ? null : temperature,
    // RSSI/SNR ovdje se odnose na ZADNJI PRIMLJENI DOWNLINK, a ne na ovaj uplink
    downlinkRssi: -parseInt(payload.slice(18, 20), 16),
    downlinkSnr: -parseInt(payload.slice(20, 22), 16),
  };
}

function decodeEnergy(payload) {
  const mask = parseInt(payload.slice(10, 14), 16);
  let rest = payload.slice(14);

  const values = {};
  for (let i = 0; i < ENERGY_PARAMS.length; i++) {
    if (!(mask & (1 << i))) continue;
    const p = ENERGY_PARAMS[i];
    const raw = rest.slice(0, p.size);
    if (raw.length < p.size) break; // payload krac nego sto maska tvrdi
    rest = rest.slice(p.size);

    let value;
    if (p.scaled) value = scaledValue(raw);
    else if (p.duration) value = parseInt(raw, 16);
    else value = parseInt(raw, 16) / (p.div ?? 1);

    values[p.key] = {
      label: p.label,
      value,
      unit: p.unit ?? null,
      display: p.duration ? formatDuration(value) : `${value}${p.unit ? ' ' + p.unit : ''}`,
    };
  }

  return {
    type: 'ENERGY',
    label: 'Energetska poruka',
    deviceTime: readTimestamp(payload.slice(2, 10)),
    values,
  };
}

function decodeAlarm(payload) {
  const bits = parseInt(payload.slice(2, 4), 16);
  const errors = ALARM_BITS.filter((_, i) => bits & (1 << i));
  return {
    type: 'ALARM',
    label: 'Alarmna poruka',
    errorBits: bits,
    errors,
    // bez ijednog postavljenog bita uredaj javlja da je greska otklonjena
    cleared: bits === 0,
  };
}

function decodeBoot(payload) {
  // noviji firmware ubacuje jos jedan bajt (patch verziju) pa se sve iza
  // pomice za dva hex znaka
  const hasPatch = payload.length >= 30;
  const off = hasPatch ? 2 : 0;

  const major = parseInt(payload.slice(2, 4), 16);
  const minor = parseInt(payload.slice(4, 6), 16);
  const patch = hasPatch ? parseInt(payload.slice(6, 8), 16) : null;

  return {
    type: 'BOOT',
    label: 'Boot poruka',
    firmwareVersion: hasPatch ? `${major}.${minor}.${patch}` : `${major}.${minor}`,
    deviceTime: readTimestamp(payload.slice(6 + off, 14 + off)),
    meanNightDurationSeconds: parseInt(payload.slice(14 + off, 22 + off), 16),
    daliStatus: parseInt(payload.slice(22 + off, 24 + off), 16),
    profileIndex: parseInt(payload.slice(24 + off, 26 + off), 16),
    brightness: brightnessPercent(payload.slice(26 + off, 28 + off)),
  };
}

const DECODERS = {
  '01': decodeStatus,
  '02': decodeEnergy,
  '03': decodeAlarm,
  '04': decodeBoot,
};

/// najmanja duljina payloada po tipu, u hex znakovima
const MIN_LENGTH = { '01': 22, '02': 14, '03': 4, '04': 28 };

/**
 * Dekodira hex payload uplinka.
 * Nikad ne baca - nepoznat ili neispravan okvir vraca type 'UNKNOWN'.
 * @param {string} payload - hex string
 * @returns {object}
 */
export function decodeUplink(payload) {
  const hex = String(payload || '').replace(/\s/g, '').toLowerCase();
  const type = hex.slice(0, 2);

  const decoder = DECODERS[type];
  if (!decoder || hex.length < MIN_LENGTH[type]) {
    return { type: 'UNKNOWN', label: 'Nepoznata poruka', raw: hex };
  }

  try {
    return { ...decoder(hex), raw: hex };
  } catch {
    return { type: 'UNKNOWN', label: 'Nepoznata poruka', raw: hex };
  }
}
