// Kota Sawit — program penyerahan entry gta6-01 (Node 22, hanya standard library).
// Game-nya adalah file statis di game/ (game/index.html + modul ES, tanpa library dan
// tanpa network request). Program ini menyalin game/ dan screenshots/ dari samping file
// ini ke /output lalu menulis /output/dossier.json, ringkasan yang dibaca juri, dengan
// library make.fun yang divendor. Jalankan dua kali: kedua run menulis byte yang sama.
//
// Di luar container grader, MAKEFUN_OUTPUT_DIR menggantikan /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Batas-batas scorer (reference/gate.json): hanya text_max_bytes yang membentuk byte;
// sisanya menolak entry yang memang akan ditolak scorer (lebih dari 4 screenshot atau
// satu di atas 256 KiB; lebih dari 993 file di game/ atau 48 MiB file game, atau path di
// bawah game/ di atas 1000 byte: game/ dihitung bersama batas 1000 entri /output,
// screenshots/ dan dossier.json-nya).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
