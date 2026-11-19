// Kota prosedural "Kota Sawit": grid jalan, blok gedung, taman, kebun sawit, pelabuhan.
// Satu seed selalu menghasilkan kota yang sama. Bangunan adalah AABB untuk tabrakan.
import { CITY, PALETTE } from './config.js';
import { mulberry32, pick, range, rangeInt } from './random.js';

export class City {
  constructor(seed) {
    this.seed = seed;
    const rng = mulberry32(seed);
    this.roadsX = [];
    for (let x = 210; x < CITY.width; x += CITY.roadGap) this.roadsX.push(x);
    this.roadsY = [];
    for (let y = 210; y < CITY.height; y += CITY.roadGap) this.roadsY.push(y);
    this.buildings = []; // {x,y,w,h,color,roof,h}
    this.parks = []; // {x,y,w,h}
    this.palms = []; // {x,y,r,lean}
    this.lamps = []; // {x,y}
    this.water = { x: 2920, y: 1560, w: CITY.width - 2920, h: CITY.height - 1560 };
    this.docks = [];
    this.plaza = { x: 1470, y: 210, w: 420, h: 420 };
    this.generate(rng);
  }

  generate(rng) {
    // Blok di antara jalan: satu blok per sel grid.
    for (let ix = 0; ix < this.roadsX.length - 1; ix += 1) {
      for (let iy = 0; iy < this.roadsY.length - 1; iy += 1) {
        const x0 = this.roadsX[ix] + CITY.roadWidth / 2 + CITY.sidewalk;
        const y0 = this.roadsY[iy] + CITY.roadWidth / 2 + CITY.sidewalk;
        const x1 = this.roadsX[ix + 1] - CITY.roadWidth / 2 - CITY.sidewalk;
        const y1 = this.roadsY[iy + 1] - CITY.roadWidth / 2 - CITY.sidewalk;
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        // Air pelabuhan: blok yang jatuh di dalam air jadi dermaga, bukan gedung.
        if (x0 >= this.water.x - 40 && y0 >= this.water.y - 40) {
          this.docks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
          continue;
        }
        // Plaza pusat kota.
        if (Math.abs(cx - (this.plaza.x + this.plaza.w / 2)) < 220 && Math.abs(cy - (this.plaza.y + this.plaza.h / 2)) < 220) {
          this.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, plaza: true });
          this.scatterPalms(rng, x0, y0, x1, y1, 6);
          continue;
        }
        const inPlantation = cx < 1500 && cy > 900;
        const roll = rng();
        if (inPlantation && roll < 0.75) {
          // Kebun sawit: barisan pohon sawit rapi.
          for (let gx = x0 + 26; gx < x1 - 20; gx += 44) {
            for (let gy = y0 + 26; gy < y1 - 20; gy += 44) {
              if (rng() < 0.9) this.palms.push({ x: gx + range(rng, -6, 6), y: gy + range(rng, -6, 6), r: range(rng, 13, 18), lean: range(rng, -0.2, 0.2) });
            }
          }
          continue;
        }
        if (roll < 0.18) {
          // Taman kota.
          this.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
          this.scatterPalms(rng, x0, y0, x1, y1, 8);
          continue;
        }
        // Blok gedung: 1-3 bangunan.
        const n = rangeInt(rng, 1, 3);
        for (let b = 0; b < n; b += 1) {
          const bw = range(rng, 70, 150);
          const bh = range(rng, 60, 130);
          const bx = range(rng, x0 + 8, Math.max(x0 + 9, x1 - bw - 8));
          const by = range(rng, y0 + 8, Math.max(y0 + 9, y1 - bh - 8));
          const ci = Math.floor(rng() * PALETTE.building.length);
          this.buildings.push({
            x: bx, y: by, w: bw, h: bh,
            color: PALETTE.building[ci], roof: PALETTE.roof[ci],
            rise: rangeInt(rng, 14, 42),
          });
        }
        // Beberapa pohon di tepi blok gedung.
        this.scatterPalms(rng, x0, y0, x1, y1, 3);
      }
    }
    // Lampu jalan di setiap persimpangan.
    for (const rx of this.roadsX) {
      for (const ry of this.roadsY) {
        this.lamps.push({ x: rx + CITY.roadWidth / 2 + 6, y: ry - CITY.roadWidth / 2 - 6 });
        this.lamps.push({ x: rx - CITY.roadWidth / 2 - 6, y: ry + CITY.roadWidth / 2 + 6 });
      }
    }
  }

  scatterPalms(rng, x0, y0, x1, y1, n) {
    for (let i = 0; i < n; i += 1) {
      this.palms.push({
        x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14),
        r: range(rng, 12, 17), lean: range(rng, -0.2, 0.2),
      });
    }
  }

  onRoad(x, y) {
    const half = CITY.roadWidth / 2;
    for (const rx of this.roadsX) if (Math.abs(x - rx) <= half && y >= 0 && y <= CITY.height) return true;
    for (const ry of this.roadsY) if (Math.abs(y - ry) <= half && x >= 0 && x <= CITY.width) return true;
    return false;
  }

  // Titik di sumbu jalan terdekat + arah jalan itu ('h' atau 'v').
  nearestRoad(x, y) {
    let best = null;
    for (const rx of this.roadsX) {
      const d = Math.abs(x - rx);
      if (!best || d < best.d) best = { x: rx, y: Math.max(0, Math.min(CITY.height, y)), dir: 'v', d };
    }
    for (const ry of this.roadsY) {
      const d = Math.abs(y - ry);
      if (d < best.d) best = { x: Math.max(0, Math.min(CITY.width, x)), y: ry, dir: 'h', d };
    }
    return best;
  }

  // Tabrakan lingkaran (x, y, r) dengan gedung atau batas kota atau air.
  collides(x, y, r) {
    if (x < r || y < r || x > CITY.width - r || y > CITY.height - r) return true;
    if (x > this.water.x - r && y > this.water.y - r) return true;
    for (const b of this.buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }

  // Dorong lingkaran keluar dari gedung terdekat (dipakai setelah tabrakan).
  resolveCircle(pos, r) {
    for (const b of this.buildings) {
      const cx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(pos.y, b.y + b.h));
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r;
        pos.y = cy + (dy / d) * r;
        return true;
      }
      if (d2 <= 0.0001) {
        // Pusat lingkaran di dalam gedung: dorong ke sisi terdekat.
        const left = pos.x - b.x;
        const right = b.x + b.w - pos.x;
        const top = pos.y - b.y;
        const bottom = b.y + b.h - pos.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) pos.x = b.x - r;
        else if (m === right) pos.x = b.x + b.w + r;
        else if (m === top) pos.y = b.y - r;
        else pos.y = b.y + b.h + r;
        return true;
      }
    }
    return false;
  }

  // Titik parkir acak di pinggir jalan (untuk mobil sipil yang terparkir).
  randomParkSpot(rng) {
    const vertical = rng() < 0.5;
    if (vertical) {
      const rx = pick(rng, this.roadsX);
      const y = range(rng, 100, CITY.height - 100);
      return { x: rx + (rng() < 0.5 ? -1 : 1) * (CITY.roadWidth / 2 - 12), y, angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
    }
    const ry = pick(rng, this.roadsY);
    const x = range(rng, 100, CITY.width - 100);
    return { x, y: ry + (rng() < 0.5 ? -1 : 1) * (CITY.roadWidth / 2 - 12), angle: rng() < 0.5 ? 0 : Math.PI };
  }

  districtAt(x, y) {
    for (const d of CITY.districts) {
      if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
    }
    return 'Kota Sawit';
  }
}
