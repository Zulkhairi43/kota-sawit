// Inti permainan Kota Sawit: state machine, misi, wanted, combat, save/load.
import { CITY, PLAYER, CAR, WANTED, MISSIONS, PALETTE, SAVE_KEY } from './config.js';
import { City } from './city.js';
import { Car, Ped, Pickup, makeTrafficAI, trafficControl, policeControl } from './entities.js';
import { mulberry32, pick, range } from './random.js';

export const SCREEN = { TITLE: 'title', PLAY: 'play', PAUSE: 'pause', OVER: 'over' };

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export class Game {
  constructor(seed) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.city = new City(seed);
    this.time = 0;
    this.clockMin = 8 * 60; // jam 08:00
    this.screen = SCREEN.TITLE;
    this.overReason = null; // 'busted' | 'wasted'
    this.cam = { x: CITY.width / 2, y: CITY.height / 2 };
    this.message = null;
    this.messageAt = 0;
    this.best = 0;
    this.loadSave();
    this.reset(false);
  }

  reset(keepMoney) {
    const rng = mulberry32(this.seed + 7);
    this.player = {
      x: 630, y: 630, angle: 0, health: PLAYER.health,
      money: keepMoney ? this.player.money : 0,
      wanted: 0, hasGun: false, ammo: 0,
      mode: 'foot', car: null,
      punchCd: 0, shootCd: 0, hurtCd: 0, bustTimer: 0,
    };
    this.cars = [];
    this.peds = [];
    this.pickups = [];
    this.police = [];
    this.missions = MISSIONS.map((m, i) => ({ ...m, state: i === 0 ? 'available' : 'locked', stage: 'pickup', timer: 0 }));
    this.activeMission = null;
    this.targetCar = null;
    this.lastCrimeAt = -999;
    this.wantedTickAt = 0;
    this.wantContinue = false;
    this.titlePan = 0;
    // Mobil pemain pertama: sedan kuning terparkir di dekat spawn.
    const starter = new Car(700, 690, 0, '#e8c53d', 'player');
    starter.owned = true;
    this.cars.push(starter);
    // Mobil sipil terparkir.
    for (let i = 0; i < 8; i += 1) {
      const spot = this.city.randomParkSpot(rng);
      const parked = new Car(spot.x, spot.y, spot.angle, pick(rng, PALETTE.car), 'parked');
      this.cars.push(parked);
    }
    // Lalu lintas.
    for (let i = 0; i < 14; i += 1) {
      const ai = makeTrafficAI(rng, this.city);
      const car = new Car(ai.x, ai.y, ai.axis === 'v' ? (ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ai.dir > 0 ? 0 : Math.PI), pick(rng, PALETTE.car), 'traffic');
      car.ai = ai;
      this.cars.push(car);
    }
    // Pejalan kaki di trotoar.
    for (let i = 0; i < 22; i += 1) {
      this.peds.push(this.spawnPed(rng));
    }
    // Pickup senjata di tiga titik kota.
    for (const [px, py] of [[700, 210], [2100, 630], [2730, 1890]]) {
      this.pickups.push(new Pickup(px, py, 'gun'));
    }
    this.screen = SCREEN.TITLE;
    this.overReason = null;
  }

  spawnPed(rng) {
    const road = this.city.nearestRoad(range(rng, 200, CITY.width - 200), range(rng, 200, CITY.height - 200));
    const off = CITY.roadWidth / 2 + 8;
    if (road.dir === 'v') return new Ped(road.x + (rng() < 0.5 ? -off : off), road.y, rng);
    return new Ped(road.x, road.y + (rng() < 0.5 ? -off : off), rng);
  }

  loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data.money === 'number') {
        this.saveData = data;
        this.best = data.money || 0;
      }
    } catch (e) {
      this.saveData = null;
    }
  }

  save() {
    try {
      const done = this.missions.filter((m) => m.state === 'done').map((m) => m.id);
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.player.money,
        missionsDone: done,
        x: this.player.x,
        y: this.player.y,
        hasGun: this.player.hasGun,
        ammo: this.player.ammo,
      }));
    } catch (e) {
      // localStorage bisa tidak tersedia; permainan tetap jalan.
    }
  }

  continueFromSave() {
    if (!this.saveData) return;
    this.wantContinue = false;
    this.player.money = this.saveData.money || 0;
    this.player.x = this.saveData.x || 630;
    this.player.y = this.saveData.y || 630;
    this.player.hasGun = !!this.saveData.hasGun;
    this.player.ammo = this.saveData.ammo || 0;
    for (const m of this.missions) {
      if (this.saveData.missionsDone && this.saveData.missionsDone.includes(m.id)) m.state = 'done';
    }
    const next = this.missions.find((m) => m.state === 'locked');
    const firstOpen = this.missions.find((m) => m.state === 'available');
    if (!firstOpen && next) next.state = 'available';
  }

  toast(text) {
    this.message = text;
    this.messageAt = this.time;
  }

  addWanted(n, reason) {
    const p = this.player;
    if (p.wanted >= WANTED.max) return;
    p.wanted = Math.min(WANTED.max, p.wanted + n);
    this.lastCrimeAt = this.time;
    if (reason) this.toast(`${reason} — Wanted naik ke ${p.wanted} bintang!`);
  }

  startMission(m) {
    m.state = 'active';
    this.activeMission = m;
    m.stage = 'pickup';
    m.timer = 0;
    if (m.id === 'kejar') this.spawnTargetCar();
    if (m.id === 'kabur') {
      this.player.wanted = Math.max(this.player.wanted, 3);
      this.lastCrimeAt = this.time;
      m.timer = MISSIONS.find((x) => x.id === 'kabur').survive;
    }
    this.toast(`Misi dimulai: ${m.name} — ${m.brief}`);
    this.save();
  }

  spawnTargetCar() {
    const p = this.player;
    const spot = this.city.nearestRoad(p.x + 500, p.y - 300);
    const car = new Car(spot.x, spot.y, 0, '#e86a2a', 'target');
    car.ai = { cruise: 300 };
    this.cars.push(car);
    this.targetCar = car;
  }

  completeMission(m) {
    m.state = 'done';
    this.activeMission = null;
    this.player.money += m.reward;
    this.best = Math.max(this.best, this.player.money);
    this.toast(`Misi selesai! +$${m.reward} — ${m.name}`);
    const next = this.missions.find((x) => x.state === 'locked');
    if (next) {
      next.state = 'available';
      this.toast(`Misi baru tersedia: ${next.name}`);
    } else {
      this.toast('Semua misi selesai! Kamu menguasai Kota Sawit.');
    }
    this.save();
  }

  failMission(m, why) {
    m.state = 'available';
    this.activeMission = null;
    if (this.targetCar) {
      this.targetCar.dead = true;
      this.targetCar = null;
    }
    this.toast(`Misi gagal: ${why}. Coba lagi di marker.`);
  }

  nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.cars) {
      if (c.dead) continue;
      const d = dist(this.player.x, this.player.y, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  enterCar(car) {
    const p = this.player;
    p.mode = 'car';
    p.car = car;
    p.enteredAt = this.time;
    car.kind = 'player';
    car.ai = null;
    if (!car.owned) {
      car.owned = true;
      this.addWanted(1, 'Mobil dicuri');
    }
  }

  exitCar() {
    const p = this.player;
    const car = p.car;
    if (!car) return;
    p.mode = 'foot';
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    p.angle = car.angle;
    p.car = null;
    car.owned = true;
  }

  hurtPlayer(amount) {
    const p = this.player;
    if (p.hurtCd > 0 || this.screen !== SCREEN.PLAY) return;
    p.health -= amount;
    p.hurtCd = 0.6;
    if (p.health <= 0) {
      p.health = 0;
      this.gameOver('wasted');
    }
  }

  gameOver(reason) {
    this.overReason = reason;
    this.screen = SCREEN.OVER;
    this.save();
  }

  // ---- update utama ----
  update(dt, input, audio) {
    this.time += dt;
    this.clockMin += dt; // 1 detik nyata = 1 menit game
    if (this.screen === SCREEN.TITLE) {
      this.titlePan += dt * 24;
      this.cam.x = 1700 + Math.sin(this.titlePan * 0.0022) * 500;
      this.cam.y = 1300 + Math.cos(this.titlePan * 0.0016) * 300;
      if (input.wasPressed('c') && this.saveData) this.wantContinue = true;
      if (input.wasPressed('Enter') || input.mouse.clicked) {
        audio.resume();
        this.screen = SCREEN.PLAY;
        if (this.wantContinue) this.continueFromSave();
        this.toast('Selamat datang di Kota Sawit. Cari marker kuning untuk misi pertama.');
      }
      return;
    }
    if (this.screen === SCREEN.OVER) {
      if (input.wasPressed('r') || input.wasPressed('Enter') || input.mouse.clicked) {
        const money = this.player.money;
        this.reset(true);
        this.player.money = money;
        this.screen = SCREEN.PLAY;
      }
      return;
    }
    if (this.screen === SCREEN.PLAY && (input.wasPressed('p') || input.wasPressed('Escape'))) {
      this.screen = SCREEN.PAUSE;
      return;
    }
    if (this.screen === SCREEN.PAUSE) {
      if (input.wasPressed('p') || input.wasPressed('Escape') || input.wasPressed('Enter')) {
        this.screen = SCREEN.PLAY;
      }
      return;
    }
    if (this.screen !== SCREEN.PLAY) return;

    const p = this.player;
    p.punchCd = Math.max(0, p.punchCd - dt);
    p.shootCd = Math.max(0, p.shootCd - dt);
    p.hurtCd = Math.max(0, p.hurtCd - dt);

    // --- pemain jalan kaki ---
    if (p.mode === 'foot') {
      const ax = input.axis();
      const run = input.down('Shift');
      const sp = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const nx = p.x + ax.x * sp * dt;
      const ny = p.y + ax.y * sp * dt;
      if (!this.city.collides(nx, p.y, PLAYER.radius)) p.x = nx;
      if (!this.city.collides(p.x, ny, PLAYER.radius)) p.y = ny;
      if (ax.x !== 0 || ax.y !== 0) p.angle = Math.atan2(ax.y, ax.x);
      // Masuk mobil (E).
      if (input.wasPressed('e')) {
        const car = this.nearestCar(64);
        if (car) this.enterCar(car);
        else {
          // Ambil pickup senjata di dekat kaki.
          for (const pk of this.pickups) {
            if (!pk.taken && dist(p.x, p.y, pk.x, pk.y) < 44) {
              pk.taken = true;
              p.hasGun = true;
              p.ammo += 12;
              audio.pickup();
              this.toast('Pistol didapat! Amunisi +12. Tekan G atau klik untuk menembak.');
            }
          }
        }
      }
      // Pukul (F atau Spasi).
      if ((input.wasPressed('f') || input.wasPressed(' ')) && p.punchCd <= 0) {
        p.punchCd = PLAYER.punchCooldown;
        audio.punch();
        const fx = p.x + Math.cos(p.angle) * PLAYER.punchRange;
        const fy = p.y + Math.sin(p.angle) * PLAYER.punchRange;
        for (const ped of this.peds) {
          if (ped.down <= 0 && dist(fx, fy, ped.x, ped.y) < 26) {
            ped.down = 4;
            ped.flee = 4;
            ped.fleeX = ped.x - p.x;
            ped.fleeY = ped.y - p.y;
            if (this.police.some((pc) => dist(pc.x, pc.y, p.x, p.y) < 520)) {
              this.addWanted(1, 'Memukul warga di depan polisi');
            }
          }
        }
      }
      // Tembak (G atau klik mouse).
      if ((input.wasPressed('g') || input.mouse.clicked) && p.hasGun && p.ammo > 0 && p.shootCd <= 0) {
        p.shootCd = 0.3;
        p.ammo -= 1;
        audio.shoot();
        const aim = input.mouse.clicked
          ? Math.atan2(input.mouse.y - 400, input.mouse.x - 640) + this.camAngleOffset()
          : p.angle;
        let bestTarget = null;
        let bestD = 340;
        for (const pc of this.police) {
          if (pc.dead) continue;
          const d = dist(p.x, p.y, pc.x, pc.y);
          if (d < bestD && Math.abs(angleDiff(aim, Math.atan2(pc.y - p.y, pc.x - p.x))) < 0.35) {
            bestD = d;
            bestTarget = pc;
          }
        }
        if (bestTarget) {
          bestTarget.damage(34);
          this.addWanted(1, 'Menembak polisi');
          if (bestTarget.dead) this.toast('Mobil polisi dilumpuhkan!');
        }
        this.lastCrimeAt = this.time;
      }
      if (p.ammo === 0 && p.hasGun) this.toast('Amunisi habis — cari pickup pistol (ikon kuning).');
    }

    // --- pemain mengemudi ---
    if (p.mode === 'car' && p.car) {
      const car = p.car;
      const ax = input.axis();
      const control = {
        throttle: ax.y < 0 ? 1 : ax.y > 0 ? -1 : 0,
        steer: ax.x,
        brake: input.down(' '),
      };
      car.step(dt, control, this.city);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      if (input.wasPressed('e') && this.time - (p.enteredAt || -99) > 0.3) this.exitCar();
      if (car.dead) {
        this.exitCar();
        this.hurtPlayer(20);
        this.toast('Mobilmu mogok! Cari mobil lain.');
      }
    }

    // --- lalu lintas ---
    const allCars = this.cars;
    for (const c of this.cars) {
      if (c.kind === 'traffic' && !c.dead) {
        c.step(dt, trafficControl(c, dt, this.city, allCars, this.time), this.city);
      }
    }
    // Tabrakan mobil-mobil (lingkaran).
    for (let i = 0; i < allCars.length; i += 1) {
      const a = allCars[i];
      if (a.dead) continue;
      for (let j = i + 1; j < allCars.length; j += 1) {
        const b = allCars[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = 30;
        if (d < min && d > 0.01) {
          const push = (min - d) / 2;
          const ux = dx / d;
          const uy = dy / d;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
          const impact = Math.abs(a.forwardSpeed() - b.forwardSpeed());
          if (impact > 200) {
            a.damage((impact - 200) * 0.04);
            b.damage((impact - 200) * 0.04);
            if (a === p.car || b === p.car) {
              audio.crash(impact / 400);
              if (impact > 320) this.hurtPlayer(8);
            }
          }
          // Tabrakan dengan polisi saat mengemudi menaikkan wanted pelan-pelan.
          if ((a.kind === 'police' && b === p.car) || (b.kind === 'police' && a === p.car)) {
            if (impact > 240 && this.time - this.lastCrimeAt > 4) this.addWanted(1, 'Menabrak mobil polisi');
          }
        }
      }
    }

    // --- pejalan kaki ---
    const threats = [];
    if (p.mode === 'car' && p.car) threats.push({ x: p.car.x, y: p.car.y, radius: 150 });
    else threats.push({ x: p.x, y: p.y, radius: 60 });
    for (const ped of this.peds) ped.step(dt, this.city, threats);
    // Mobil pemain menabrak pejalan kaki.
    if (p.mode === 'car' && p.car && Math.abs(p.car.speed) > 130) {
      for (const ped of this.peds) {
        if (ped.down <= 0 && dist(p.car.x, p.car.y, ped.x, ped.y) < 26) {
          ped.down = 6;
          ped.flee = 5;
          ped.fleeX = ped.x - p.car.x;
          ped.fleeY = ped.y - p.car.y;
          audio.crash(0.5);
          this.addWanted(1, 'Menabrak pejalan kaki');
          this.hurtPlayer(0);
          p.car.vx *= 0.85;
          p.car.vy *= 0.85;
        }
      }
    }
    // Mobil traffic menabrak pemain jalan kaki.
    if (p.mode === 'foot') {
      for (const c of this.cars) {
        if (c.dead || c.kind === 'player') continue;
        if (dist(p.x, p.y, c.x, c.y) < 26 && Math.abs(c.forwardSpeed()) > 60) {
          this.hurtPlayer(15);
          p.x += (p.x - c.x) * 0.4;
          p.y += (p.y - c.y) * 0.4;
        }
      }
    }

    // --- wanted & polisi ---
    this.updateWanted(dt);
    // Polisi mengejar.
    for (const pc of this.police) {
      if (pc.dead) continue;
      pc.step(dt, policeControl(pc, p, dt), this.city);
      // Polisi menabrak pemain jalan kaki = tangkap / luka.
      if (p.mode === 'foot' && dist(pc.x, pc.y, p.x, p.y) < WANTED.bustRadius) {
        if (Math.abs(pc.forwardSpeed()) < 90) {
          p.bustTimer += dt;
          if (p.bustTimer >= WANTED.bustHold) {
            this.gameOver('busted');
            return;
          }
        } else {
          this.hurtPlayer(12);
        }
      }
      // Polisi menempel mobil pemain yang hampir berhenti = tangkap.
      if (p.mode === 'car' && p.car && dist(pc.x, pc.y, p.car.x, p.car.y) < 52 && Math.abs(p.car.speed) < 40) {
        p.bustTimer += dt;
        if (p.bustTimer >= WANTED.bustHold) {
          this.gameOver('busted');
          return;
        }
      }
    }
    if (this.police.every((pc) => dist(pc.x, pc.y, p.x, p.y) > WANTED.bustRadius + 40)) p.bustTimer = 0;

    // --- misi ---
    this.updateMissions(dt, input);

    // --- respawn lalu lintas & pejalan kaki ---
    this.maintainPopulation();

    // --- kamera ---
    const tx = clamp(p.x, 640, CITY.width - 640);
    const ty = clamp(p.y, 400, CITY.height - 400);
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 5);

    // --- suara ---
    const driving = p.mode === 'car' && p.car;
    audio.setEngine(driving ? Math.abs(p.car.speed) / CAR.maxSpeed : 0, driving);
    audio.setSiren(p.wanted > 0 && this.police.some((pc) => !pc.dead && dist(pc.x, pc.y, p.x, p.y) < 800), dt);

    // Simpan berkala (tiap ~20 detik).
    if (Math.floor(this.time) % 20 === 0 && Math.floor(this.time - dt) % 20 !== 0) this.save();
  }

  updateWanted(dt) {
    const p = this.player;
    const want = WANTED.policeByStars[p.wanted] || 0;
    // Tambah polisi sampai jumlah yang sesuai bintang.
    const alive = this.police.filter((pc) => !pc.dead);
    if (alive.length < want) {
      const spot = this.city.nearestRoad(
        p.x + (Math.random() < 0.5 ? -1 : 1) * 700,
        p.y + (Math.random() < 0.5 ? -1 : 1) * 700,
      );
      const pc = new Car(spot.x, spot.y, 0, PALETTE.police, 'police');
      this.cars.push(pc);
      this.police.push(pc);
    }
    // Buang polisi yang terlalu jauh saat wanted 0.
    if (p.wanted === 0) {
      for (const pc of this.police) {
        if (!pc.dead && dist(pc.x, pc.y, p.x, p.y) > 1200) pc.dead = true;
      }
      this.police = this.police.filter((pc) => !pc.dead);
      this.cars = this.cars.filter((c) => !(c.kind === 'police' && c.dead));
    }
    // Peluruhan bintang kalau lama tidak berbuat jahat dan tidak ada polisi dekat.
    if (p.wanted > 0 && this.time - this.lastCrimeAt > WANTED.decayDelay) {
      const nearPolice = this.police.some((pc) => !pc.dead && dist(pc.x, pc.y, p.x, p.y) < 700);
      if (!nearPolice) {
        if (this.time - this.wantedTickAt > WANTED.decayStep) {
          this.wantedTickAt = this.time;
          p.wanted -= 1;
          if (p.wanted === 0) this.toast('Kamu lolos dari kejaran polisi.');
        }
      } else {
        this.wantedTickAt = this.time;
      }
    } else {
      this.wantedTickAt = this.time;
    }
  }

  updateMissions(dt) {
    const p = this.player;
    // Aktivasi: sentuh marker misi yang tersedia.
    for (const m of this.missions) {
      if (m.state !== 'available') continue;
      const at = m.pickup || { x: 0, y: 0 };
      const mx = m.id === 'kejar' ? 1700 : at.x;
      const my = m.id === 'kejar' ? 500 : at.y;
      if (dist(p.x, p.y, mx, my) < 56) {
        this.startMission(m);
        break;
      }
    }
    const m = this.activeMission;
    if (!m) return;
    if (m.id === 'paket' || m.id === 'penumpang') {
      const target = m.stage === 'pickup' ? m.pickup : m.drop;
      if (dist(p.x, p.y, target.x, target.y) < 56) {
        if (m.stage === 'pickup') {
          m.stage = 'drop';
          this.toast(m.id === 'paket' ? 'Paket diambil! Antar ke tujuannya.' : 'Penumpang naik! Antar ke tujuannya.');
        } else {
          this.completeMission(m);
        }
      }
    }
    if (m.id === 'kejar') {
      const tc = this.targetCar;
      if (!tc) return;
      // Target kabur menjauhi pemain.
      const dx = tc.x - p.x;
      const dy = tc.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const desired = Math.atan2(dy, dx);
      let diff = desired - tc.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      tc.step(dt, { throttle: 1, steer: clamp(diff * 2.4, -1, 1), brake: false }, this.city);
      if (tc.health <= 25) {
        this.completeMission(m);
        tc.dead = true;
        this.targetCar = null;
      } else if (d > 1500) {
        this.failMission(m, 'target kabur terlalu jauh');
      }
    }
    if (m.id === 'kabur') {
      m.timer -= dt;
      if (m.timer <= 0) {
        this.player.wanted = 0;
        this.completeMission(m);
      }
    }
  }

  maintainPopulation() {
    const p = this.player;
    // Lalu lintas: jaga 14 mobil aktif; tambah yang baru jauh dari pemain.
    const traffic = this.cars.filter((c) => c.kind === 'traffic' && !c.dead);
    if (traffic.length < 14) {
      const ai = makeTrafficAI(this.rng, this.city);
      const car = new Car(ai.x, ai.y, ai.axis === 'v' ? (ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ai.dir > 0 ? 0 : Math.PI), pick(this.rng, PALETTE.car), 'traffic');
      car.ai = ai;
      this.cars.push(car);
    }
    // Buang mobil traffic yang terlalu jauh.
    for (const c of this.cars) {
      if (c.kind === 'traffic' && dist(c.x, c.y, p.x, p.y) > 1600) {
        const ai = makeTrafficAI(this.rng, this.city);
        c.x = ai.x;
        c.y = ai.y;
        c.ai = ai;
        c.angle = ai.axis === 'v' ? (ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ai.dir > 0 ? 0 : Math.PI);
      }
    }
    // Pejalan kaki: jaga 22.
    if (this.peds.length < 22) this.peds.push(this.spawnPed(this.rng));
    for (const ped of this.peds) {
      if (ped.down <= 0 && dist(ped.x, ped.y, p.x, p.y) > 1500) {
        const np = this.spawnPed(this.rng);
        ped.x = np.x;
        ped.y = np.y;
      }
    }
    // Pickup pistol respawn.
    for (const pk of this.pickups) {
      if (pk.taken && this.time - (pk.takenAt || 0) > 60) {
        pk.taken = false;
      }
      if (pk.taken && !pk.takenAt) pk.takenAt = this.time;
    }
  }

  // Offset sudut kamera untuk bidikan mouse (kamera selalu di tengah layar).
  camAngleOffset() {
    return 0;
  }

  missionMarker() {
    const m = this.activeMission;
    if (m) {
      if (m.id === 'kejar' && this.targetCar) return { x: this.targetCar.x, y: this.targetCar.y, label: 'Target' };
      if (m.id === 'kabur') return null;
      const t = m.stage === 'pickup' ? m.pickup : m.drop;
      return { x: t.x, y: t.y, label: m.stage === 'pickup' ? 'Ambil' : 'Antar' };
    }
    for (const av of this.missions) {
      if (av.state === 'available') {
        const at = av.pickup || { x: 1700, y: 500 };
        return { x: av.id === 'kejar' ? 1700 : at.x, y: av.id === 'kejar' ? 500 : at.y, label: av.name, available: true };
      }
    }
    return null;
  }

  objectiveText() {
    const m = this.activeMission;
    if (!m) {
      const av = this.missions.find((x) => x.state === 'available');
      if (av) return `Misi tersedia: ${av.name} — cari marker kuning di peta`;
      if (this.missions.every((x) => x.state === 'done')) return 'Semua misi selesai — jelajahi kota sesukamu!';
      return 'Cari misi berikutnya';
    }
    if (m.id === 'paket') return m.stage === 'pickup' ? 'Misi: Ambil paket di gudang pelabuhan' : 'Misi: Antar paket ke toko pusat kota';
    if (m.id === 'penumpang') return m.stage === 'pickup' ? 'Misi: Jemput penumpang di taman kota' : 'Misi: Antar penumpang ke pelabuhan';
    if (m.id === 'kejar') return 'Misi: Tabrak mobil target sampai mogok!';
    if (m.id === 'kabur') return `Misi: Bertahan dari polisi! ${Math.ceil(m.timer)} detik lagi`;
    return m.name;
  }
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
