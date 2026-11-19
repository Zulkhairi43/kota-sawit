// Staging screenshot deterministik: setiap scene memainkan aturan game yang sesungguhnya
// maju dari dunia baru, disetir autopilot sederhana, jadi frame-nya adalah game yang
// benar-benar terjadi dan seed yang sama selalu memberi frame yang sama.
// Dipakai lewat ?shot=title|drive|wanted|mission&seed=N.
import { SCREEN } from './game.js';
import { trafficControl } from './entities.js';

const STEP = 1 / 60;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Sopir autopilot: ikuti sumbu jalan terdekat lurus ke depan.
function driveAxis(car, game) {
  const road = game.city.nearestRoad(car.x, car.y);
  let tx;
  let ty;
  if (road.dir === 'v') {
    tx = road.x + (car.aiLane || 0);
    ty = car.y + Math.sin(car.angle) * 300;
  } else {
    tx = car.x + Math.cos(car.angle) * 300;
    ty = road.y + (car.aiLane || 0);
  }
  const desired = Math.atan2(ty - car.y, tx - car.x);
  const steer = clamp(angleDiff(desired, car.angle) * 2.4, -1, 1);
  const fwd = car.forwardSpeed();
  return { throttle: fwd < 380 ? 0.9 : 0, steer, brake: false };
}

function makeDriver(game, mode, target) {
  return {
    axis() {
      const p = game.player;
      if (mode === 'walk' && target) {
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        return { x: dx / d, y: dy / d };
      }
      if (mode === 'drive' && p.car) {
        const c = driveAxis(p.car, game);
        // Terjemahkan kontrol mobil ke axis: x = setir, y = -gas / +mundur.
        return { x: c.steer, y: c.throttle > 0 ? -1 : 0, _car: c };
      }
      return { x: 0, y: 0 };
    },
    down() {
      return false;
    },
    wasPressed() {
      return false;
    },
    mouse: { x: 640, y: 400, clicked: false, down: false },
    endFrame() {},
  };
}

// Menjalankan update game dengan input palsu; untuk mode drive, kontrol mobil
// dihitung dari driveAxis tiap langkah dan disuntik lewat axis().y/.x.
function runWithDriver(game, seconds, mode, target, audio) {
  const input = makeDriver(game, mode, target);
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    // Untuk mode drive, game.update membaca axis() -> {x: steer, y: -1 gas}.
    // Kontrol throttle penuh sudah tercakup (axis.y -1 = gas).
    game.update(STEP, input, audio);
    if (game.screen !== SCREEN.PLAY) break;
  }
}

const nullAudio = {
  resume() {},
  setEngine() {},
  setSiren() {},
  pickup() {},
  shoot() {},
  punch() {},
  crash() {},
  jingle() {},
  busted() {},
  blip() {},
};

/** Set `game` ke scene bernama dan kembalikan layar yang digambar. */
export function stageShot(name, game) {
  game.reset(false);
  if (name === 'title') {
    // Latar hidup: lalu lintas jalan 6 detik sementara kamera menyapu kota.
    for (let i = 0; i < 6 / STEP; i += 1) {
      game.titlePan += STEP * 24;
      game.cam.x = 1700 + Math.sin(game.titlePan * 0.0022) * 500;
      game.cam.y = 1300 + Math.cos(game.titlePan * 0.0016) * 300;
      for (const c of game.cars) {
        if (c.kind === 'traffic' && !c.dead) c.step(STEP, trafficControl(c, STEP, game.city, game.cars, i * STEP), game.city);
      }
    }
    game.screen = SCREEN.TITLE;
    return SCREEN.TITLE;
  }
  game.screen = SCREEN.PLAY;
  if (name === 'drive') {
    const starter = game.cars[0];
    game.enterCar(starter);
    starter.x = 630;
    starter.y = 630;
    starter.angle = 0;
    game.player.x = starter.x;
    game.player.y = starter.y;
    runWithDriver(game, 7, 'drive', null, nullAudio);
    return SCREEN.PLAY;
  }
  if (name === 'wanted') {
    const starter = game.cars[0];
    game.enterCar(starter);
    starter.x = 1050;
    starter.y = 1050;
    starter.angle = 0;
    game.player.x = starter.x;
    game.player.y = starter.y;
    game.player.wanted = 3;
    game.lastCrimeAt = game.time;
    game.updateWanted(0);
    // Tarik polisi lebih dekat ke belakang pemain supaya kejaran terlihat dramatis.
    for (const pc of game.police) {
      const side = (game.rng() - 0.5) * 90;
      pc.x = game.player.x - Math.cos(game.player.angle) * 300 - Math.sin(game.player.angle) * side;
      pc.y = game.player.y - Math.sin(game.player.angle) * 300 + Math.cos(game.player.angle) * side;
      pc.angle = game.player.angle;
    }
    runWithDriver(game, 5, 'drive', null, nullAudio);
    return SCREEN.PLAY;
  }
  if (name === 'mission') {
    // Misi pertama aktif, pemain jalan kaki menuju marker paket.
    const m = game.missions[0];
    game.startMission(m);
    game.player.x = m.pickup.x - 170;
    game.player.y = m.pickup.y + 60;
    runWithDriver(game, 2.2, 'walk', m.pickup, nullAudio);
    return SCREEN.PLAY;
  }
  game.screen = SCREEN.TITLE;
  return SCREEN.TITLE;
}
