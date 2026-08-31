// pocetni podaci za razvoj: dva korisnika s razlicitim ulogama i tri testne
// lampe koje stvarno postoje na xl_chirpstack ChirpStack aplikaciji

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// lozinka za razvoj
const SEED_PASSWORD = process.env.SEED_PASSWORD || 'lozinka123';

const KORISNICI = [
  { username: 'admin', email: 'admin@x-logic.net', role: 'ADMIN' },
  { username: 'ivica', email: 'ivica.srdojevic@x-logic.net', role: 'USER' },
];

// koordinate i nazivi ulica preuzeti iz produkcijske baze za ove devEUI adrese
const LAMPE = [
  { devEui: '8cf95720001e223d', name: 'Trnjanski nasip', latitude: 45.790839, longitude: 15.980698 },
  { devEui: '8cf95720001e3845', name: 'Obala trnjanskih branitelja', latitude: 45.790524, longitude: 15.981706 },
  { devEui: '8cf95720001e292d', name: 'Avenija Veceslava Holjevca', latitude: 45.790510, longitude: 15.979572 },
];

async function main() {
  const hash = await bcrypt.hash(SEED_PASSWORD, 10);

  const users = {};
  for (const k of KORISNICI) {
    users[k.username] = await prisma.user.upsert({
      where: { username: k.username },
      update: { email: k.email, role: k.role },
      create: { ...k, password: hash },
    });
    console.log(`korisnik: ${k.username} (${k.role})`);
  }

  // lampe pripadaju obicnom korisniku, ne adminu - tako se na prvom pokretanju
  // vidi da scoping radi: admin ih vidi jer je admin, ivica jer je vlasnik
  const owner = users.ivica;
  for (const l of LAMPE) {
    await prisma.lamp.upsert({
      where: { devEui: l.devEui },
      update: { name: l.name, latitude: l.latitude, longitude: l.longitude },
      create: { ...l, ownerId: owner.id },
    });
    console.log(`lampa: ${l.name} (${l.devEui})`);
  }

  console.log(`\nGotovo. Lozinka za oba korisnika: ${SEED_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
