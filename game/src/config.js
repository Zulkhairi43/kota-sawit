// Kota Sawit — semua angka penyeimbang dan palet kota dalam satu tempat.
// Kota fiktif tropis: jalan grid, perkebunan sawit di pinggir, pelabuhan di selatan.
export const VIEW = { width: 1280, height: 800 };

export const CITY = {
  width: 3400,
  height: 2600,
  roadGap: 420, // jarak antar sumbu jalan
  roadWidth: 78,
  sidewalk: 14,
  // daerah kota: [x0, y0, x1, y1, nama]
  districts: [
    { x0: 0, y0: 0, x1: 3400, y1: 900, name: 'Pusat Kota' },
    { x0: 0, y0: 900, x1: 1500, y1: 2600, name: 'Kebun Sawit' },
    { x0: 1500, y0: 900, x1: 3400, y1: 2600, name: 'Pelabuhan' },
  ],
};

export const PLAYER = {
  walkSpeed: 205,
  runSpeed: 300,
  radius: 13,
  health: 100,
  punchRange: 34,
  punchDamage: 12,
  punchCooldown: 0.38,
};

export const CAR = {
  accel: 430,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 190,
  turnRate: 2.6, // rad/detik pada kecepatan penuh
  grip: 3.2, // seberapa cepat arah gerak mengikuti arah mobil
  length: 46,
  width: 22,
  health: 100,
};

export const TRAFFIC = {
  count: 14,
  speedMin: 130,
  speedMax: 210,
};

export const PED = {
  count: 22,
  speedMin: 34,
  speedMax: 62,
};

export const WANTED = {
  max: 5,
  decayDelay: 18, // detik tanpa kejahatan sebelum bintang mulai turun
  decayStep: 9, // detik per satu bintang turun
  policeByStars: [0, 1, 1, 2, 3, 3],
  bustRadius: 46,
  bustHold: 1.6, // detik polisi menempel sebelum BUSTED
};

export const MISSIONS = [
  {
    id: 'paket',
    name: 'Antar Paket',
    brief: 'Ambil paket di gudang pelabuhan, antar ke toko di pusat kota.',
    reward: 150,
    pickup: { x: 2900, y: 2100 },
    drop: { x: 700, y: 300 },
  },
  {
    id: 'kejar',
    name: 'Kejar Target',
    brief: 'Target kabur naik mobil oranye. Tabrak sampai mobilnya mogok.',
    reward: 200,
    targetCar: true,
  },
  {
    id: 'kabur',
    name: 'Kabur dari Polisi',
    brief: 'Polisi mengejarmu. Bertahan 30 detik tanpa tertangkap.',
    reward: 250,
    pickup: { x: 1700, y: 500 },
    survive: 30,
  },
  {
    id: 'penumpang',
    name: 'Antar Penumpang',
    brief: 'Jemput penumpang di taman kota, antar ke pelabuhan.',
    reward: 180,
    pickup: { x: 1650, y: 500 },
    drop: { x: 3050, y: 2300 },
  },
];

export const PALETTE = {
  grass: '#7fae4e',
  grassDark: '#6f9c42',
  plantation: '#5d8f3a',
  road: '#3a3f4a',
  roadLine: '#e8d44d',
  sidewalk: '#b9b3a4',
  building: ['#c96f4a', '#4a7fa5', '#8a6fb0', '#b0a24a', '#5aa08a', '#a54a6b', '#7a8a99', '#d08a3e'],
  roof: ['#8a4a34', '#2f4a63', '#5d4a78', '#7a6a2a', '#3a6a58', '#6e2f4a', '#4a5560', '#8a5a22'],
  water: '#3f8fb5',
  sand: '#d9c48a',
  palm: '#3f7a2e',
  palmTrunk: '#8a6a42',
  car: ['#d94f3d', '#3d7fd9', '#e8c53d', '#7ad9c1', '#e8e8e8', '#8a5fd9', '#3dd97a', '#d97ab0'],
  police: '#2b3a55',
  player: '#ffd23d',
  playerShirt: '#2b6cb0',
};

export const SAVE_KEY = 'kotasawit_save_v1';
