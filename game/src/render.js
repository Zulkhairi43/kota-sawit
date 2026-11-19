// Semua gambar di canvas 2D: kota, mobil, pejalan kaki, HUD, minimap, menu.
import { VIEW, CITY, CAR, PALETTE } from './config.js';
import { SCREEN } from './game.js';

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function drawGame(ctx, game, input) {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  if (game.screen === SCREEN.TITLE) {
    drawWorld(ctx, game);
    drawTitle(ctx, game);
    return;
  }
  drawWorld(ctx, game);
  drawHUD(ctx, game, input);
  if (game.screen === SCREEN.PAUSE) drawPause(ctx);
  if (game.screen === SCREEN.OVER) drawOver(ctx, game);
}

function drawWorld(ctx, game) {
  const { cam } = game;
  const vx0 = cam.x - VIEW.width / 2;
  const vy0 = cam.y - VIEW.height / 2;
  ctx.save();
  ctx.translate(-vx0, -vy0);
  // Rumput dasar + variasi petak.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(vx0 - 40, vy0 - 40, VIEW.width + 80, VIEW.height + 80);
  ctx.fillStyle = PALETTE.grassDark;
  const cell = 210;
  const xStart = Math.floor(vx0 / cell) * cell;
  const yStart = Math.floor(vy0 / cell) * cell;
  for (let x = xStart; x < vx0 + VIEW.width + cell; x += cell) {
    for (let y = yStart; y < vy0 + VIEW.height + cell; y += cell) {
      if (((x / cell + y / cell) | 0) % 2 === 0) ctx.fillRect(x, y, cell, cell);
    }
  }
  // Air pelabuhan + pasir pantai.
  const w = game.city.water;
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(w.x - 26, w.y - 26, w.w + 26, w.h + 26);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(w.x, w.y, w.w, w.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(w.x + 20, w.y + 60 + i * 90);
    ctx.bezierCurveTo(w.x + 120, w.y + 40 + i * 90, w.x + 220, w.y + 80 + i * 90, w.x + 340, w.y + 55 + i * 90);
    ctx.stroke();
  }
  // Dermaga.
  ctx.fillStyle = '#8a6a42';
  for (const d of game.city.docks) ctx.fillRect(d.x, d.y, d.w, d.h);
  // Taman & plaza.
  for (const pk of game.city.parks) {
    ctx.fillStyle = pk.plaza ? '#c9b896' : '#5d8f3a';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    if (pk.plaza) {
      ctx.fillStyle = '#7fae4e';
      ctx.beginPath();
      ctx.arc(pk.x + pk.w / 2, pk.y + pk.h / 2, 46, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Trotoar di sekeliling jalan.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of game.city.roadsX) ctx.fillRect(rx - CITY.roadWidth / 2 - CITY.sidewalk, vy0 - 40, CITY.roadWidth + CITY.sidewalk * 2, VIEW.height + 80);
  for (const ry of game.city.roadsY) ctx.fillRect(vx0 - 40, ry - CITY.roadWidth / 2 - CITY.sidewalk, VIEW.width + 80, CITY.roadWidth + CITY.sidewalk * 2);
  // Aspal jalan.
  ctx.fillStyle = PALETTE.road;
  for (const rx of game.city.roadsX) ctx.fillRect(rx - CITY.roadWidth / 2, vy0 - 40, CITY.roadWidth, VIEW.height + 80);
  for (const ry of game.city.roadsY) ctx.fillRect(vx0 - 40, ry - CITY.roadWidth / 2, VIEW.width + 80, CITY.roadWidth);
  // Garis tengah jalan putus-putus.
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const rx of game.city.roadsX) {
    ctx.beginPath();
    ctx.moveTo(rx, vy0 - 40);
    ctx.lineTo(rx, vy0 + VIEW.height + 40);
    ctx.stroke();
  }
  for (const ry of game.city.roadsY) {
    ctx.beginPath();
    ctx.moveTo(vx0 - 40, ry);
    ctx.lineTo(vx0 + VIEW.width + 40, ry);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Zebra cross di persimpangan.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const rx of game.city.roadsX) {
    for (const ry of game.city.roadsY) {
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillRect(rx - CITY.roadWidth / 2 + 8, ry + i * 12 - 4, 12, 7);
        ctx.fillRect(rx + CITY.roadWidth / 2 - 20, ry + i * 12 - 4, 12, 7);
      }
    }
  }
  // Gedung dengan bayangan atap (pseudo-3D).
  for (const b of game.city.buildings) {
    if (b.x > vx0 + VIEW.width + 60 || b.x + b.w < vx0 - 60 || b.y > vy0 + VIEW.height + 60 || b.y + b.h < vy0 - 60) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + b.rise * 0.25, b.y + b.rise * 0.35, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const rows = Math.max(1, Math.floor(b.h / 34));
    const cols = Math.max(1, Math.floor(b.w / 30));
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        ctx.fillRect(b.x + 10 + c * 30, b.y + 10 + r * 34, 12, 14);
      }
    }
  }
  // Pohon sawit.
  for (const t of game.city.palms) {
    if (t.x < vx0 - 40 || t.x > vx0 + VIEW.width + 40 || t.y < vy0 - 40 || t.y > vy0 + VIEW.height + 40) continue;
    ctx.strokeStyle = PALETTE.palmTrunk;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x + t.lean * 30, t.y - 14);
    ctx.stroke();
    ctx.fillStyle = PALETTE.palm;
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + t.lean;
      ctx.beginPath();
      ctx.ellipse(t.x + t.lean * 30 + Math.cos(a) * t.r * 0.55, t.y - 14 + Math.sin(a) * t.r * 0.55, t.r * 0.62, t.r * 0.26, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Lampu jalan.
  ctx.fillStyle = '#e8d44d';
  for (const l of game.city.lamps) {
    if (l.x < vx0 - 20 || l.x > vx0 + VIEW.width + 20 || l.y < vy0 - 20 || l.y > vy0 + VIEW.height + 20) continue;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pickup senjata.
  for (const pk of game.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(game.time * 3 + pk.bob) * 3;
    ctx.fillStyle = 'rgba(255,210,61,0.25)';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y + bob, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(pk.x - 12, pk.y - 4 + bob, 24, 8);
    ctx.fillRect(pk.x + 6, pk.y - 8 + bob, 8, 5);
  }
  // Marker misi (denyut kuning).
  const marker = game.missionMarker();
  if (marker && game.screen !== SCREEN.TITLE) {
    const pulse = 1 + Math.sin(game.time * 4) * 0.12;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = marker.available ? '#ffd23d' : '#ff5d3d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = marker.available ? '#ffd23d' : '#ff5d3d';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(marker.label, marker.x, marker.y - 34);
  }
  // Mobil (parkir, traffic, polisi, target, pemain).
  for (const car of game.cars) {
    if (car.dead && car.kind !== 'police') continue;
    if (car.x < vx0 - 80 || car.x > vx0 + VIEW.width + 80 || car.y < vy0 - 80 || car.y > vy0 + VIEW.height + 80) continue;
    drawCar(ctx, car, game);
  }
  // Pejalan kaki.
  for (const ped of game.peds) {
    if (ped.x < vx0 - 30 || ped.x > vx0 + VIEW.width + 30 || ped.y < vy0 - 30 || ped.y > vy0 + VIEW.height + 30) continue;
    drawPed(ctx, ped, game);
  }
  // Pemain jalan kaki.
  const p = game.player;
  if (p.mode === 'foot' && game.screen !== SCREEN.TITLE) drawPlayer(ctx, p, game);
  ctx.restore();
}

function drawCar(ctx, car, game) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Bayangan.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
  // Badan.
  ctx.fillStyle = car.dead ? '#555' : car.color;
  roundRect(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
  ctx.fill();
  // Kaca depan/belakang + atap.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.fillRect(CAR.length / 2 - 14, -CAR.width / 2 + 4, 9, CAR.width - 8);
  ctx.fillRect(-CAR.length / 2 + 5, -CAR.width / 2 + 4, 8, CAR.width - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-6, -CAR.width / 2 + 4, 14, CAR.width - 8);
  // Ban.
  ctx.fillStyle = '#111';
  ctx.fillRect(-CAR.length / 2 + 2, -CAR.width / 2 - 3, 10, 5);
  ctx.fillRect(-CAR.length / 2 + 2, CAR.width / 2 - 2, 10, 5);
  ctx.fillRect(CAR.length / 2 - 12, -CAR.width / 2 - 3, 10, 5);
  ctx.fillRect(CAR.length / 2 - 12, CAR.width / 2 - 2, 10, 5);
  if (car.kind === 'police') {
    // Lampu polisi berkedip.
    const on = Math.floor(game.time * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff3b30' : '#3b82ff';
    ctx.fillRect(-4, -CAR.width / 2 + 2, 8, 5);
    ctx.fillStyle = on ? '#3b82ff' : '#ff3b30';
    ctx.fillRect(-4, CAR.width / 2 - 7, 8, 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLISI', 0, 3);
  }
  if (car.kind === 'target') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TARGET', 0, 3);
  }
  if (car.kind === 'player') {
    ctx.strokeStyle = '#ffd23d';
    ctx.lineWidth = 2.5;
    roundRect(ctx, -CAR.length / 2 - 3, -CAR.width / 2 - 3, CAR.length + 6, CAR.width + 6, 9);
    ctx.stroke();
  }
  ctx.restore();
  // Asap kalau rusak.
  if (car.smoke > 0.15) {
    ctx.fillStyle = `rgba(120,120,120,${0.25 + car.smoke * 0.4})`;
    ctx.beginPath();
    ctx.arc(car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, 8 + Math.sin(game.time * 9) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bar nyawa mobil target / polisi saat rusak.
  if ((car.kind === 'target' || car.kind === 'police') && car.health < CAR.health) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(car.x - 22, car.y - 30, 44, 6);
    ctx.fillStyle = car.health > 40 ? '#7ad95d' : '#ff5d3d';
    ctx.fillRect(car.x - 21, car.y - 29, 42 * (car.health / CAR.health), 4);
  }
}

function drawPed(ctx, ped, game) {
  const bob = ped.down > 0 ? 0 : Math.sin(ped.walkPhase) * 2;
  ctx.save();
  ctx.translate(ped.x, ped.y + bob * 0.4);
  if (ped.down > 0) {
    // Terkapar.
    ctx.rotate(1.2);
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 7, 8, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(0, -3, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, p, game) {
  const bob = Math.sin(game.time * 10) * 1.5;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 9, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Badan + arah hadap.
  ctx.rotate(p.angle);
  ctx.fillStyle = '#2b6cb0';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd23d';
  ctx.fillRect(6, -4, 9, 8);
  ctx.restore();
  // Lingkaran penanda pemain.
  ctx.strokeStyle = 'rgba(255,210,61,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 17 + Math.sin(game.time * 3) * 1.5, 0, Math.PI * 2);
  ctx.stroke();
  if (p.hasGun) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🔫 ${p.ammo}`, p.x, p.y - 24);
  }
  void bob;
}

function drawHUD(ctx, game, input) {
  const p = game.player;
  // Panel atas kiri: nyawa, uang, jam.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, 14, 12, 300, 86, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.money}`, 28, 40);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#ffd23d';
  const hh = Math.floor(game.clockMin / 60) % 24;
  const mm = Math.floor(game.clockMin % 60);
  ctx.fillText(`Kota Sawit · ${game.city.districtAt(p.x, p.y)} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, 28, 62);
  // Bar nyawa.
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(28, 72, 180, 10);
  ctx.fillStyle = p.health > 40 ? '#7ad95d' : '#ff5d3d';
  ctx.fillRect(28, 72, 180 * (p.health / 100), 10);
  ctx.fillStyle = '#fff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(p.health)}`, 214, 81);
  // Bintang wanted, atas tengah.
  for (let i = 0; i < 5; i += 1) {
    ctx.font = '26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = i < p.wanted ? '#ffd23d' : 'rgba(255,255,255,0.3)';
    ctx.fillText('★', 590 + i * 32, 44);
  }
  if (p.wanted > 0) {
    ctx.fillStyle = '#ff5d3d';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('POLISI MENGEJAR', 640, 66);
  }
  // Kecepatan saat mengemudi.
  if (p.mode === 'car' && p.car) {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, 14, VIEW.height - 66, 150, 52, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.32)} km/j`, 28, VIEW.height - 30);
  }
  // Objektif misi, bawah tengah.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  const obj = game.objectiveText();
  ctx.font = 'bold 15px system-ui, sans-serif';
  const objW = ctx.measureText(obj).width + 32;
  roundRect(ctx, (VIEW.width - objW) / 2, VIEW.height - 52, objW, 36, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd23d';
  ctx.textAlign = 'center';
  ctx.fillText(obj, VIEW.width / 2, VIEW.height - 28);
  // Pesan toast.
  if (game.message && game.time - game.messageAt < 5) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    const tw = ctx.measureText(game.message).width + 32;
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    roundRect(ctx, (VIEW.width - tw) / 2, 84, tw, 36, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(game.message, VIEW.width / 2, 108);
  }
  // Kontrol singkat, kiri bawah.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD jalan · E masuk/keluar mobil · F pukul · G tembak · P jeda', 16, VIEW.height - 74);
  // Minimap.
  drawMinimap(ctx, game);
}

function drawMinimap(ctx, game) {
  const mw = 220;
  const mh = 168;
  const mx = VIEW.width - mw - 14;
  const my = 12;
  const sx = mw / CITY.width;
  const sy = mh / CITY.height;
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#5d8f3a';
  ctx.fillRect(mx, my, mw, mh);
  // Air.
  ctx.fillStyle = '#3f8fb5';
  ctx.fillRect(mx + game.city.water.x * sx, my + game.city.water.y * sy, game.city.water.w * sx, game.city.water.h * sy);
  // Jalan.
  ctx.strokeStyle = '#3a3f4a';
  ctx.lineWidth = 4;
  for (const rx of game.city.roadsX) {
    ctx.beginPath();
    ctx.moveTo(mx + rx * sx, my);
    ctx.lineTo(mx + rx * sx, my + mh);
    ctx.stroke();
  }
  for (const ry of game.city.roadsY) {
    ctx.beginPath();
    ctx.moveTo(mx, my + ry * sy);
    ctx.lineTo(mx + mw, my + ry * sy);
    ctx.stroke();
  }
  // Gedung.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const b of game.city.buildings) ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  // Marker misi.
  const marker = game.missionMarker();
  if (marker) {
    const pulse = 5 + Math.sin(game.time * 4) * 2;
    ctx.fillStyle = marker.available ? '#ffd23d' : '#ff5d3d';
    ctx.beginPath();
    ctx.arc(mx + marker.x * sx, my + marker.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Polisi.
  ctx.fillStyle = '#3b82ff';
  for (const pc of game.police) {
    if (pc.dead) continue;
    ctx.beginPath();
    ctx.arc(mx + pc.x * sx, my + pc.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pemain.
  const p = game.player;
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  // Bingkai kamera di minimap.
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    mx + (game.cam.x - VIEW.width / 2) * sx,
    my + (game.cam.y - VIEW.height / 2) * sy,
    VIEW.width * sx,
    VIEW.height * sy,
  );
}

function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(8,12,18,0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 92px system-ui, sans-serif';
  ctx.fillText('KOTA SAWIT', VIEW.width / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('Kota terbuka tropis — curi mobil, kabur dari polisi, selesaikan misi.', VIEW.width / 2, 348);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('WASD / panah — jalan & mengemudi      E — masuk / keluar mobil', VIEW.width / 2, 420);
  ctx.fillText('F — pukul      G / klik — tembak      P — jeda      Misi: antar paket, kejar target, kabur, antar penumpang', VIEW.width / 2, 448);
  const blink = Math.floor(game.time * 1.4) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('Tekan ENTER atau klik untuk mulai', VIEW.width / 2, 530);
  }
  if (game.saveData) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(`Save ditemukan: $${game.saveData.money} — tekan C lalu ENTER untuk lanjut`, VIEW.width / 2, 570);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Game orisinal — kota, karakter, dan cerita fiktif. Dibangun untuk make.fun.', VIEW.width / 2, 760);
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(8,12,18,0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText('JEDA', VIEW.width / 2, 380);
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Tekan P atau ENTER untuk lanjut', VIEW.width / 2, 430);
}

function drawOver(ctx, game) {
  ctx.fillStyle = 'rgba(8,12,18,0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = game.overReason === 'busted' ? '#3b82ff' : '#ff5d3d';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText(game.overReason === 'busted' ? 'BUSTED!' : 'WASTED!', VIEW.width / 2, 360);
  ctx.fillStyle = '#fff';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText(
    game.overReason === 'busted' ? 'Polisi menangkapmu di Kota Sawit.' : 'Kamu kehabisan nyawa di Kota Sawit.',
    VIEW.width / 2, 410,
  );
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(`Uang: $${game.player.money} · Misi selesai: ${game.missions.filter((m) => m.state === 'done').length}/4`, VIEW.width / 2, 452);
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('Tekan R untuk main lagi', VIEW.width / 2, 520);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
