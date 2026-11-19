// Mobil, pejalan kaki, dan pickup. Fisika arcade: kecepatan maju + grip lateral.
import { CAR, CITY, TRAFFIC, PED, PALETTE } from './config.js';
import { pick, range, mulberry32 } from './random.js';

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// Satu mobil untuk semua peran: pemain, traffic, polisi, target misi.
export class Car {
  constructor(x, y, angle, color, kind) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = 0;
    this.vy = 0;
    this.color = color;
    this.kind = kind; // 'player' | 'traffic' | 'police' | 'target' | 'parked'
    this.health = CAR.health;
    this.speed = 0;
    this.throttle = 0;
    this.steer = 0;
    this.brake = false;
    this.smoke = 0; // 0..1, mobil rusak berasap
    this.dead = false;
    this.stuck = 0;
    this.ai = null;
    this.lastHitAt = -99;
  }

  forwardSpeed() {
    return this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle);
  }

  // control: {throttle -1..1, steer -1..1, brake bool}
  step(dt, control, city) {
    if (this.dead) return;
    const fwd = this.forwardSpeed();
    const spd = Math.abs(fwd);
    // Belok hanya saat bergerak; makin cepat makin responsif sampai batas.
    const steerAuthority = clamp(spd / 140, 0, 1);
    this.angle += control.steer * CAR.turnRate * steerAuthority * dt * (fwd < 0 ? -1 : 1);
    const ax = Math.cos(this.angle);
    const ay = Math.sin(this.angle);
    if (control.throttle > 0) {
      this.vx += ax * CAR.accel * control.throttle * dt;
      this.vy += ay * CAR.accel * control.throttle * dt;
    } else if (control.throttle < 0) {
      if (fwd > 8) {
        // Rem dulu sebelum mundur.
        this.vx -= ax * CAR.brake * dt;
        this.vy -= ay * CAR.brake * dt;
      } else {
        this.vx += ax * CAR.reverseAccel * control.throttle * dt;
        this.vy += ay * CAR.reverseAccel * control.throttle * dt;
      }
    }
    if (control.brake) {
      this.vx *= Math.max(0, 1 - 4.5 * dt);
      this.vy *= Math.max(0, 1 - 4.5 * dt);
    }
    // Grip: redam gerak menyamping, jaga gerak maju.
    const f = this.vx * ax + this.vy * ay;
    const lx = this.vx - f * ax;
    const ly = this.vy - f * ay;
    const grip = Math.exp(-CAR.grip * dt);
    this.vx = f * ax + lx * grip;
    this.vy = f * ay + ly * grip;
    // Batasi kecepatan.
    const f2 = this.vx * ax + this.vy * ay;
    const maxF = this.kind === 'police' ? CAR.maxSpeed * 1.15 : CAR.maxSpeed;
    if (f2 > maxF) {
      this.vx -= ax * (f2 - maxF);
      this.vy -= ay * (f2 - maxF);
    } else if (f2 < -CAR.maxReverse) {
      this.vx -= ax * (f2 + CAR.maxReverse);
      this.vy -= ay * (f2 + CAR.maxReverse);
    }
    // Gesekan ringan.
    this.vx *= Math.max(0, 1 - 0.12 * dt);
    this.vy *= Math.max(0, 1 - 0.12 * dt);
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;
    // Tabrakan gedung: uji titik depan dan belakang mobil.
    const half = CAR.length / 2 - 4;
    const fx = nx + ax * half;
    const fy = ny + ay * half;
    const bx = nx - ax * half;
    const by = ny - ay * half;
    if (city.collides(fx, fy, 12) || city.collides(bx, by, 12) || city.collides(nx, ny, 12)) {
      // Pantulkan sebagian kecepatan dan beri kerusakan kalau keras.
      const impact = Math.abs(f2);
      this.vx *= -0.32;
      this.vy *= -0.32;
      if (impact > 260) this.damage((impact - 260) * 0.05);
      this.stuck += dt;
    } else {
      this.x = nx;
      this.y = ny;
      this.stuck = 0;
    }
    this.speed = this.forwardSpeed();
    if (this.health < 40) this.smoke = Math.min(1, this.smoke + dt * 0.2);
  }

  damage(amount) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.smoke = 1;
    }
  }
}

// AI lalu lintas: ikuti grid jalan, belok acak di persimpangan.
export function makeTrafficAI(rng, city) {
  const vertical = rng() < 0.5;
  let x;
  let y;
  let axis;
  let dir;
  if (vertical) {
    x = pick(rng, city.roadsX);
    y = range(rng, 100, CITY.height - 100);
    axis = 'v';
    dir = rng() < 0.5 ? 1 : -1;
  } else {
    y = pick(rng, city.roadsY);
    x = range(rng, 100, CITY.width - 100);
    axis = 'h';
    dir = rng() < 0.5 ? 1 : -1;
  }
  return { axis, dir, lane: (rng() < 0.5 ? -1 : 1) * (CITY.roadWidth / 4), cruise: range(rng, TRAFFIC.speedMin, TRAFFIC.speedMax), x, y, wait: 0, rng: mulberry32(Math.floor(rng() * 1000000000)) };
}

export function trafficControl(car, dt, city, others, time) {
  const ai = car.ai;
  if (ai.wait > 0) {
    ai.wait -= dt;
    return { throttle: 0, steer: 0, brake: true };
  }
  // Target: titik di depan sepanjang sumbu jalan saat ini.
  let tx;
  let ty;
  if (ai.axis === 'v') {
    tx = ai.x + ai.lane;
    ty = car.y + ai.dir * 300;
  } else {
    tx = car.x + ai.dir * 300;
    ty = ai.y + ai.lane;
  }
  // Di persimpangan (dekat sumbu jalan tegak lurus): peluang belok.
  const nearX = city.roadsX.find((rx) => Math.abs(car.x - rx) < 14 && ai.axis === 'h');
  const nearY = city.roadsY.find((ry) => Math.abs(car.y - ry) < 14 && ai.axis === 'v');
  if (nearX !== undefined || nearY !== undefined) {
    const r = ai.rng();
    if (r < 0.3) {
      // Belok: ganti sumbu.
      if (ai.axis === 'h') {
        ai.axis = 'v';
        ai.x = nearX;
        ai.dir = ai.rng() < 0.5 ? 1 : -1;
        ai.lane = (ai.rng() < 0.5 ? -1 : 1) * (CITY.roadWidth / 4);
      } else {
        ai.axis = 'h';
        ai.y = nearY;
        ai.dir = ai.rng() < 0.5 ? 1 : -1;
        ai.lane = (ai.rng() < 0.5 ? -1 : 1) * (CITY.roadWidth / 4);
      }
    }
  }
  // Rem kalau ada mobil lain tepat di depan.
  let blocked = false;
  for (const o of others) {
    if (o === car || o.dead) continue;
    const dx = o.x - car.x;
    const dy = o.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 70) {
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      if (ahead > 0) {
        blocked = true;
        break;
      }
    }
  }
  const desiredAngle = Math.atan2(ty - car.y, tx - car.x);
  let diff = desiredAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = clamp(diff * 2.2, -1, 1);
  const cruise = blocked ? 0 : ai.cruise;
  const fwd = car.forwardSpeed();
  const throttle = fwd < cruise ? 0.55 : 0;
  return { throttle, steer, brake: blocked };
}

// AI polisi: kejar pemain, tabrak untuk menghentikan.
export function policeControl(car, target, dt) {
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  const desiredAngle = Math.atan2(dy, dx);
  let diff = desiredAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = clamp(diff * 2.6, -1, 1);
  // Kalau sudah sangat dekat dan pemain jalan kaki: pelan, siap menangkap.
  const throttle = dist > 60 ? 1 : 0.35;
  return { throttle, steer, brake: false };
}

// Pejalan kaki: jalan di trotoar, kabur kalau ada bahaya.
export class Ped {
  constructor(x, y, rng) {
    this.x = x;
    this.y = y;
    this.angle = range(rng, 0, Math.PI * 2);
    this.speed = range(rng, PED.speedMin, PED.speedMax);
    this.color = pick(rng, ['#e86a92', '#6ab0e8', '#e8b06a', '#9ae86a', '#c96ae8', '#e8e8e8']);
    this.flee = 0;
    this.fleeX = 0;
    this.fleeY = 0;
    this.down = 0; // terkapar setelah ditabrak
    this.retarget = 0;
    this.walkPhase = range(rng, 0, Math.PI * 2);
  }

  step(dt, city, threats) {
    if (this.down > 0) {
      this.down -= dt;
      return;
    }
    // Kabur dari ancaman (mobil pemain yang dekat/cepat, tembakan, pukulan).
    let fx = 0;
    let fy = 0;
    for (const t of threats) {
      const dx = this.x - t.x;
      const dy = this.y - t.y;
      const d = Math.hypot(dx, dy);
      if (d < t.radius) {
        fx += (dx / (d + 1)) * (1 - d / t.radius);
        fy += (dy / (d + 1)) * (1 - d / t.radius);
      }
    }
    if (fx !== 0 || fy !== 0) {
      this.flee = 2.5;
      this.fleeX = fx;
      this.fleeY = fy;
    }
    let mx;
    let my;
    let sp = this.speed;
    if (this.flee > 0) {
      this.flee -= dt;
      const fl = Math.hypot(this.fleeX, this.fleeY) || 1;
      mx = this.fleeX / fl;
      my = this.fleeY / fl;
      sp = this.speed * 2.4;
    } else {
      this.retarget -= dt;
      if (this.retarget <= 0) {
        this.retarget = range(Math.random, 2, 6);
        // Pilih arah sepanjang jalan terdekat (trotoar).
        const road = city.nearestRoad(this.x, this.y);
        if (road.dir === 'v') {
          this.angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          this.angle = Math.random() < 0.5 ? 0 : Math.PI;
        }
      }
      mx = Math.cos(this.angle);
      my = Math.sin(this.angle);
    }
    const nx = this.x + mx * sp * dt;
    const ny = this.y + my * sp * dt;
    if (!city.collides(nx, ny, 8)) {
      this.x = nx;
      this.y = ny;
    } else {
      this.angle += Math.PI / 2;
    }
    this.walkPhase += dt * sp * 0.09;
  }
}

export class Pickup {
  constructor(x, y, kind) {
    this.x = x;
    this.y = y;
    this.kind = kind; // 'gun' | 'cash'
    this.taken = false;
    this.bob = Math.random() * Math.PI * 2;
  }
}
