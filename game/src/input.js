// Keyboard + mouse. Menyimpan state tombol dan klik sekali (edge-triggered).
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // tombol yang baru ditekan sejak frame lalu
    this.mouse = { x: 0, y: 0, clicked: false, down: false };
    this._onKeyDown = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
    };
    this._onKeyUp = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(k);
    };
    this._onMouseMove = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * 1280;
      this.mouse.y = ((e.clientY - r.top) / r.height) * 800;
    };
    this._onMouseDown = (e) => {
      this._onMouseMove(e);
      this.mouse.down = true;
      this.mouse.clicked = true;
    };
    this._onMouseUp = () => {
      this.mouse.down = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouse.down = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  down(key) {
    return this.keys.has(key);
  }

  wasPressed(key) {
    return this.pressed.has(key);
  }

  // Arah jalan kaki / setir dari WASD atau panah.
  axis() {
    let x = 0;
    let y = 0;
    if (this.down('a') || this.down('ArrowLeft')) x -= 1;
    if (this.down('d') || this.down('ArrowRight')) x += 1;
    if (this.down('w') || this.down('ArrowUp')) y -= 1;
    if (this.down('s') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}
