// Kota Sawit — boot. Mode normal: loop requestAnimationFrame.
// Mode screenshot: ?shot=title|drive|wanted|mission&seed=N — staging satu frame lalu berhenti.
import { Game, SCREEN } from './game.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { drawGame } from './render.js';
import { stageShot } from './shots.js';
import { VIEW } from './config.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || '1') || 1;
const shot = params.get('shot');

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const ctx = canvas.getContext('2d');

const game = new Game(seed);
const input = new Input(canvas);
const audio = new AudioSys();

// Kait baca-saja untuk playtest otomatis.
window.__kota = {
  game,
  input,
  audio,
  ready: true,
  state() {
    const p = game.player;
    return {
      screen: game.screen,
      overReason: game.overReason,
      x: Math.round(p.x),
      y: Math.round(p.y),
      mode: p.mode,
      health: Math.round(p.health),
      money: p.money,
      wanted: p.wanted,
      ammo: p.ammo,
      hasGun: p.hasGun,
      speed: p.car ? Math.round(Math.abs(p.car.speed)) : 0,
      missions: game.missions.map((m) => `${m.id}:${m.state}`),
      activeMission: game.activeMission ? game.activeMission.id : null,
      cars: game.cars.length,
      police: game.police.filter((c) => !c.dead).length,
      peds: game.peds.length,
    };
  },
};

if (shot) {
  stageShot(shot, game);
  drawGame(ctx, game, input);
  window.__kota.shot = shot;
} else {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      game.update(dt, input, audio);
      drawGame(ctx, game, input);
    } catch (err) {
      console.error(err);
    }
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
