class MeasureBoxEditor {
  constructor(canvas, renderCallback, initialBox, onUpdate, isBarLineFn) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.renderCallback = renderCallback;
    this.box = { ...initialBox };
    this.isBarLineFn = isBarLineFn;
    this.activeAction = null;
    this.dragStart = { x: 0, y: 0 };
    this.initBox = { ...initialBox };
    this.loupeEl = document.getElementById('touchLoupe');
    this.loupeCanvas = document.getElementById('loupeCanvas');
    this.loupeCtx = this.loupeCanvas ? this.loupeCanvas.getContext('2d') : null;
    this.render();
  }

  getHandleScale() {
    const rect = this.canvas.getBoundingClientRect();
    const displayW = rect.width > 0 ? rect.width : window.innerWidth;
    return Math.max(1, this.canvas.width / displayW);
  }

  hitTest(x, y, tol) {
    const scale = this.getHandleScale();
    const effectiveTol = Math.max(tol || 32, 28 * scale);
    const b = this.box;
    const r = b.left + b.width;
    const bot = b.top + b.height;

    if (Math.abs(x - b.left) <= effectiveTol && Math.abs(y - b.top) <= effectiveTol) return 'corner-tl';
    if (Math.abs(x - r) <= effectiveTol && Math.abs(y - b.top) <= effectiveTol) return 'corner-tr';
    if (Math.abs(x - b.left) <= effectiveTol && Math.abs(y - bot) <= effectiveTol) return 'corner-bl';
    if (Math.abs(x - r) <= effectiveTol && Math.abs(y - bot) <= effectiveTol) return 'corner-br';
    if (Math.abs(x - b.left) <= effectiveTol && y >= b.top && y <= bot) return 'left';
    if (Math.abs(x - r) <= effectiveTol && y >= b.top && y <= bot) return 'right';
    if (Math.abs(y - b.top) <= effectiveTol && x >= b.left && x <= r) return 'top';
    if (Math.abs(y - bot) <= effectiveTol && x >= b.left && x <= r) return 'bottom';
    if (x > b.left && x < r && y > b.top && y < bot) return 'drag';
    return null;
  }

  startDrag(action, x, y, cx, cy) {
    this.activeAction = action;
    this.dragStart = { x, y };
    this.initBox = { ...this.box };
    if (action !== 'drag') this.updateLoupe(cx, cy, x, y);
  }

  moveDrag(x, y, cx, cy) {
    if (!this.activeAction) return;
    const dx = x - this.dragStart.x;
    const dy = y - this.dragStart.y;
    const init = this.initBox;
    const minW = 20 * this.getHandleScale();
    const minH = 20 * this.getHandleScale();

    switch (this.activeAction) {
      case 'drag':
        this.box.left = Math.max(0, init.left + dx);
        this.box.top = Math.max(0, init.top + dy);
        break;
      case 'left':
      case 'corner-tl':
      case 'corner-bl': {
        const nL = Math.min(init.left + dx, init.left + init.width - minW);
        this.box.left = Math.max(0, nL);
        this.box.width = init.width - (this.box.left - init.left);
        if (this.activeAction === 'corner-tl') {
          this.box.top = Math.max(0, Math.min(init.top + dy, init.top + init.height - minH));
          this.box.height = init.height - (this.box.top - init.top);
        } else if (this.activeAction === 'corner-bl') {
          this.box.height = Math.max(minH, init.height + dy);
        }
        break;
      }
      case 'right':
      case 'corner-tr':
      case 'corner-br':
        this.box.width = Math.max(minW, init.width + dx);
        if (this.activeAction === 'corner-tr') {
          this.box.top = Math.max(0, Math.min(init.top + dy, init.top + init.height - minH));
          this.box.height = init.height - (this.box.top - init.top);
        } else if (this.activeAction === 'corner-br') {
          this.box.height = Math.max(minH, init.height + dy);
        }
        break;
      case 'top':
        this.box.top = Math.max(0, Math.min(init.top + dy, init.top + init.height - minH));
        this.box.height = init.height - (this.box.top - init.top);
        break;
      case 'bottom':
        this.box.height = Math.max(minH, init.height + dy);
        break;
    }
    this.render();
    if (this.activeAction !== 'drag') {
      const tx = this.activeAction.includes('left') ? this.box.left : (this.box.left + this.box.width);
      this.updateLoupe(cx, cy, tx, y);
    }
  }

  endDrag() {
    this.activeAction = null;
    if (this.loupeEl) this.loupeEl.style.display = 'none';
  }

  destroy() {
    if (this.loupeEl) this.loupeEl.style.display = 'none';
  }

  updateLoupe(cx, cy, tx, ty) {
    if (!this.loupeEl || !this.loupeCtx) return;
    this.loupeEl.style.display = 'block';
    this.loupeEl.style.left = cx + 'px';
    this.loupeEl.style.top = cy + 'px';
    const lw = this.loupeCanvas.width;
    const lh = this.loupeCanvas.height;
    const z = 2.0;
    const cw = lw / z;
    const ch = lh / z;
    const sx = Math.max(0, Math.min(this.canvas.width - cw, tx - cw / 2));
    const sy = Math.max(0, Math.min(this.canvas.height - ch, ty - ch / 2));
    this.loupeCtx.clearRect(0, 0, lw, lh);
    this.loupeCtx.drawImage(this.canvas, sx, sy, cw, ch, 0, 0, lw, lh);
    this.loupeCtx.strokeStyle = 'rgba(239,68,68,0.9)';
    this.loupeCtx.lineWidth = 2;
    this.loupeCtx.beginPath();
    this.loupeCtx.moveTo(lw / 2, 0);
    this.loupeCtx.lineTo(lw / 2, lh);
    this.loupeCtx.stroke();
  }

  expandMeasure(dir) {
    const step = 8;
    if (dir === 'right') {
      const curR = Math.floor(this.box.left + this.box.width);
      let f = false;
      if (this.isBarLineFn) {
        for (let x = curR + step; x < this.canvas.width; x++) {
          if (this.isBarLineFn(x)) { this.box.width = x - this.box.left; f = true; break; }
        }
      }
      if (!f) this.box.width += 140 * this.getHandleScale();
    } else {
      const curL = Math.floor(this.box.left);
      let f = false;
      if (this.isBarLineFn) {
        for (let x = curL - step; x >= 0; x--) {
          if (this.isBarLineFn(x)) { this.box.width += (this.box.left - x); this.box.left = x; f = true; break; }
        }
      }
      if (!f) {
        const stepW = 140 * this.getHandleScale();
        const nL = Math.max(0, this.box.left - stepW);
        this.box.width += (this.box.left - nL);
        this.box.left = nL;
      }
    }
    this.render();
  }

  render() {
    this.renderCallback();
    const c = this.ctx;
    const scale = this.getHandleScale();

    c.save();
    c.fillStyle = 'rgba(37, 99, 235, 0.22)';
    c.fillRect(this.box.left, this.box.top, this.box.width, this.box.height);
    c.strokeStyle = '#1d4ed8';
    c.lineWidth = Math.max(2, 3 * scale);
    c.strokeRect(this.box.left, this.box.top, this.box.width, this.box.height);

    c.fillStyle = '#ffffff';
    c.strokeStyle = '#1d4ed8';
    c.lineWidth = Math.max(1.5, 2 * scale);
    const rDot = Math.max(6, 8 * scale);

    const hs = [
      { x: this.box.left + this.box.width / 2, y: this.box.top },
      { x: this.box.left + this.box.width / 2, y: this.box.top + this.box.height },
      { x: this.box.left, y: this.box.top + this.box.height / 2 },
      { x: this.box.left + this.box.width, y: this.box.top + this.box.height / 2 },
      { x: this.box.left, y: this.box.top },
      { x: this.box.left + this.box.width, y: this.box.top },
      { x: this.box.left, y: this.box.top + this.box.height },
      { x: this.box.left + this.box.width, y: this.box.top + this.box.height }
    ];
    hs.forEach(h => {
      c.beginPath();
      c.arc(h.x, h.y, rDot, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    });
    c.restore();
  }
}

// ========================================================
// VYLEPŠENÝ 4-BODOVÝ PERSPEKTIVNÍ & DEWARP OŘEZ
// ========================================================
class PaperCropEditor {
  constructor(canvas, renderCallback, initialBox) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.renderCallback = renderCallback;

    // 4 rohové body v souřadnicích plátna
    const l = initialBox.left;
    const t = initialBox.top;
    const w = initialBox.width;
    const h = initialBox.height;

    this.corners = {
      tl: { x: l, y: t },
      tr: { x: l + w, y: t },
      br: { x: l + w, y: t + h },
      bl: { x: l, y: t + h }
    };

    // Parametry prohnutí vazby
    this.spineMode = 'none'; // 'none' | 'left' | 'right'
    this.curveAmp = 0;       // -60 až +60 px
    this.curveSpan = 0.25;   // 10 % až 45 %

    this.activeAction = null;
    this.dragStart = { x: 0, y: 0 };
    this.initCorners = null;

    this.render();
  }

  getHandleScale() {
    const rect = this.canvas.getBoundingClientRect();
    const displayW = rect.width > 0 ? rect.width : window.innerWidth;
    return Math.max(1, this.canvas.width / displayW);
  }

  setSpineMode(mode) {
    this.spineMode = mode;
    document.getElementById('cropSpineNone')?.classList.toggle('active', mode === 'none');
    document.getElementById('cropSpineLeft')?.classList.toggle('active', mode === 'left');
    document.getElementById('cropSpineRight')?.classList.toggle('active', mode === 'right');

    const showCurve = (mode !== 'none');
    const cg = document.getElementById('cropCurveGroup');
    const wg = document.getElementById('cropWidthGroup');
    if (cg) cg.style.display = showCurve ? 'flex' : 'none';
    if (wg) wg.style.display = showCurve ? 'flex' : 'none';

    this.render();
  }

  setCurveAmp(val) {
    this.curveAmp = Number(val) || 0;
    const el = document.getElementById('cropCurveVal');
    if (el) el.innerText = `${this.curveAmp >= 0 ? '+' : ''}${this.curveAmp} px`;
    this.render();
  }

  setCurveSpan(val) {
    this.curveSpan = (Number(val) || 25) / 100.0;
    const el = document.getElementById('cropWidthVal');
    if (el) el.innerText = `${Math.round(this.curveSpan * 100)} %`;
    this.render();
  }

  getGutterOffset(t) {
    if (this.spineMode === 'none' || this.curveAmp === 0) return 0;
    const span = this.curveSpan;
    if (this.spineMode === 'left') {
      if (t >= span) return 0;
      const u = t / span;
      return this.curveAmp * (0.5 + 0.5 * Math.cos(Math.PI * u));
    } else if (this.spineMode === 'right') {
      if (t <= (1.0 - span)) return 0;
      const u = (1.0 - t) / span;
      return this.curveAmp * (0.5 + 0.5 * Math.cos(Math.PI * u));
    }
    return 0;
  }

  hitTest(x, y) {
    const scale = this.getHandleScale();
    const tol = Math.max(38, 32 * scale);
    const c = this.corners;

    if (Math.hypot(x - c.tl.x, y - c.tl.y) <= tol) return 'corner-tl';
    if (Math.hypot(x - c.tr.x, y - c.tr.y) <= tol) return 'corner-tr';
    if (Math.hypot(x - c.br.x, y - c.br.y) <= tol) return 'corner-br';
    if (Math.hypot(x - c.bl.x, y - c.bl.y) <= tol) return 'corner-bl';

    // Středy hran
    const topMid = { x: (c.tl.x + c.tr.x) / 2, y: (c.tl.y + c.tr.y) / 2 };
    const botMid = { x: (c.bl.x + c.br.x) / 2, y: (c.bl.y + c.br.y) / 2 };
    const leftMid = { x: (c.tl.x + c.bl.x) / 2, y: (c.tl.y + c.bl.y) / 2 };
    const rightMid = { x: (c.tr.x + c.br.x) / 2, y: (c.tr.y + c.br.y) / 2 };

    if (Math.hypot(x - topMid.x, y - topMid.y) <= tol) return 'edge-top';
    if (Math.hypot(x - botMid.x, y - botMid.y) <= tol) return 'edge-bottom';
    if (Math.hypot(x - leftMid.x, y - leftMid.y) <= tol) return 'edge-left';
    if (Math.hypot(x - rightMid.x, y - rightMid.y) <= tol) return 'edge-right';

    // Kliknutí dovnitř polygonu = posun celého rámečku
    if (this.isPointInQuad(x, y)) return 'drag-all';

    return null;
  }

  isPointInQuad(x, y) {
    const pts = [this.corners.tl, this.corners.tr, this.corners.br, this.corners.bl];
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  startDrag(action, x, y) {
    this.activeAction = action;
    this.dragStart = { x, y };
    this.initCorners = {
      tl: { ...this.corners.tl },
      tr: { ...this.corners.tr },
      br: { ...this.corners.br },
      bl: { ...this.corners.bl }
    };
  }

  moveDrag(x, y) {
    if (!this.activeAction || !this.initCorners) return;
    const dx = x - this.dragStart.x;
    const dy = y - this.dragStart.y;
    const init = this.initCorners;
    const maxW = this.canvas.width;
    const maxH = this.canvas.height;

    const clamp = (val, max) => Math.max(0, Math.min(max, val));

    switch (this.activeAction) {
      case 'drag-all':
        ['tl', 'tr', 'br', 'bl'].forEach(k => {
          this.corners[k].x = clamp(init[k].x + dx, maxW);
          this.corners[k].y = clamp(init[k].y + dy, maxH);
        });
        break;

      case 'corner-tl':
        this.corners.tl.x = clamp(init.tl.x + dx, maxW);
        this.corners.tl.y = clamp(init.tl.y + dy, maxH);
        break;
      case 'corner-tr':
        this.corners.tr.x = clamp(init.tr.x + dx, maxW);
        this.corners.tr.y = clamp(init.tr.y + dy, maxH);
        break;
      case 'corner-br':
        this.corners.br.x = clamp(init.br.x + dx, maxW);
        this.corners.br.y = clamp(init.br.y + dy, maxH);
        break;
      case 'corner-bl':
        this.corners.bl.x = clamp(init.bl.x + dx, maxW);
        this.corners.bl.y = clamp(init.bl.y + dy, maxH);
        break;

      case 'edge-top':
        this.corners.tl.y = clamp(init.tl.y + dy, maxH);
        this.corners.tr.y = clamp(init.tr.y + dy, maxH);
        break;
      case 'edge-bottom':
        this.corners.bl.y = clamp(init.bl.y + dy, maxH);
        this.corners.br.y = clamp(init.br.y + dy, maxH);
        break;
      case 'edge-left':
        this.corners.tl.x = clamp(init.tl.x + dx, maxW);
        this.corners.bl.x = clamp(init.bl.x + dx, maxW);
        break;
      case 'edge-right':
        this.corners.tr.x = clamp(init.tr.x + dx, maxW);
        this.corners.br.x = clamp(init.br.x + dx, maxW);
        break;
    }
    this.render();
  }

  endDrag() {
    this.activeAction = null;
    this.initCorners = null;
  }

  destroy() {}

  render() {
    this.renderCallback();
    const c = this.ctx;
    const scale = this.getHandleScale();
    const corn = this.corners;

    c.save();

    // 1. Ztmavení plochy mimo ořezový polygon
    c.fillStyle = 'rgba(0, 0, 0, 0.58)';
    c.beginPath();
    c.rect(0, 0, this.canvas.width, this.canvas.height);

    // Výřez polygonu
    c.moveTo(corn.tl.x, corn.tl.y);
    c.lineTo(corn.tr.x, corn.tr.y);
    c.lineTo(corn.br.x, corn.br.y);
    c.lineTo(corn.bl.x, corn.bl.y);
    c.closePath();
    c.fill('evenodd');

    // 2. Vykreslení ohraničení s případným zakřivením vazby
    const steps = 30;
    const drawCurveEdge = (pStart, pEnd, isTop) => {
      c.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const bx = (1 - t) * pStart.x + t * pEnd.x;
        const by = (1 - t) * pStart.y + t * pEnd.y;
        const cury = by + this.getGutterOffset(t);
        if (i === 0) c.moveTo(bx, cury);
        else c.lineTo(bx, cury);
      }
      c.stroke();
    };

    c.strokeStyle = '#38bdf8';
    c.lineWidth = Math.max(2, 3 * scale);

    // Horní a dolní zakřivená hrana
    drawCurveEdge(corn.tl, corn.tr, true);
    drawCurveEdge(corn.bl, corn.br, false);

    // Boční kolmé hrany
    c.beginPath();
    c.moveTo(corn.tl.x, corn.tl.y + this.getGutterOffset(0));
    c.lineTo(corn.bl.x, corn.bl.y + this.getGutterOffset(0));
    c.moveTo(corn.tr.x, corn.tr.y + this.getGutterOffset(1));
    c.lineTo(corn.br.x, corn.br.y + this.getGutterOffset(1));
    c.stroke();

    // 3. Vodicí pomocné linie přes osnovu (pro kontrolu srovnání)
    c.save();
    c.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    c.lineWidth = 1.2 * scale;
    c.setLineDash([6 * scale, 6 * scale]);
    [0.25, 0.5, 0.75].forEach(vFrac => {
      c.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const tx = (1 - t) * corn.tl.x + t * corn.tr.x;
        const ty = (1 - t) * corn.tl.y + t * corn.tr.y;
        const bx = (1 - t) * corn.bl.x + t * corn.br.x;
        const by = (1 - t) * corn.bl.y + t * corn.br.y;
        const mx = (1 - vFrac) * tx + vFrac * bx;
        const my = (1 - vFrac) * ty + vFrac * by + this.getGutterOffset(t);
        if (i === 0) c.moveTo(mx, my);
        else c.lineTo(mx, my);
      }
      c.stroke();
    });
    c.restore();

    // 4. Rohová madla (výrazné bílé kruhy s azurovým lemem)
    const rDot = Math.max(9, 11 * scale);
    ['tl', 'tr', 'br', 'bl'].forEach(k => {
      const pt = corn[k];
      const yOff = (k === 'tl' || k === 'bl') ? this.getGutterOffset(0) : this.getGutterOffset(1);

      c.beginPath();
      c.arc(pt.x, pt.y + yOff, rDot, 0, Math.PI * 2);
      c.fillStyle = '#ffffff';
      c.fill();
      c.strokeStyle = '#38bdf8';
      c.lineWidth = Math.max(3, 4 * scale);
      c.stroke();
    });

    // 5. Středová madla hran
    const midDot = Math.max(6, 7 * scale);
    const mids = [
      { x: (corn.tl.x + corn.tr.x) / 2, y: (corn.tl.y + corn.tr.y) / 2 + this.getGutterOffset(0.5) },
      { x: (corn.bl.x + corn.br.x) / 2, y: (corn.bl.y + corn.br.y) / 2 + this.getGutterOffset(0.5) },
      { x: (corn.tl.x + corn.bl.x) / 2, y: (corn.tl.y + corn.bl.y) / 2 + this.getGutterOffset(0) },
      { x: (corn.tr.x + corn.br.x) / 2, y: (corn.tr.y + corn.br.y) / 2 + this.getGutterOffset(1) }
    ];

    mids.forEach(p => {
      c.beginPath();
      c.arc(p.x, p.y, midDot, 0, Math.PI * 2);
      c.fillStyle = '#38bdf8';
      c.fill();
      c.strokeStyle = '#ffffff';
      c.lineWidth = Math.max(1.5, 2 * scale);
      c.stroke();
    });

    c.restore();
  }

  /**
   * Provede plynulé bilineární narovnání 4 rohů a prohnutí vazby bez trojúhelníků a bez diagonálních švů
   */
  renderDewarpedResult(sourceCanvas) {
    const c = this.corners;

    // Rozměry cílového narovnaného obdélníku
    const topW = Math.hypot(c.tr.x - c.tl.x, c.tr.y - c.tl.y);
    const botW = Math.hypot(c.br.x - c.bl.x, c.br.y - c.bl.y);
    const leftH = Math.hypot(c.bl.x - c.tl.x, c.bl.y - c.tl.y);
    const rightH = Math.hypot(c.br.x - c.tr.x, c.br.y - c.tr.y);

    const dstW = Math.max(100, Math.round((topW + botW) / 2));
    const dstH = Math.max(100, Math.round((leftH + rightH) / 2));

    const srcW = sourceCanvas.width;
    const srcH = sourceCanvas.height;
    const srcCtx = sourceCanvas.getContext('2d');
    const srcImgData = srcCtx.getImageData(0, 0, srcW, srcH);
    const srcData = srcImgData.data;
    const srcStride = srcW << 2;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = dstW;
    outCanvas.height = dstH;
    const outCtx = outCanvas.getContext('2d');
    const outImgData = outCtx.createImageData(dstW, dstH);
    const outData = outImgData.data;

    // Předpočet prohnutí vazby pro každý sloupec u (0 .. dstW - 1)
    const gutterOffsets = new Float32Array(dstW);
    const denomW = Math.max(1, dstW - 1);
    for (let u = 0; u < dstW; u++) {
      gutterOffsets[u] = this.getGutterOffset(u / denomW);
    }

    const denomH = Math.max(1, dstH - 1);
    let outIdx = 0;

    // Plynulý řádkový přepočet pixelů s bilineárním vyhlazením
    for (let v = 0; v < dstH; v++) {
      const vNorm = v / denomH;
      const lx = (1 - vNorm) * c.tl.x + vNorm * c.bl.x;
      const ly = (1 - vNorm) * c.tl.y + vNorm * c.bl.y;
      const rx = (1 - vNorm) * c.tr.x + vNorm * c.br.x;
      const ry = (1 - vNorm) * c.tr.y + vNorm * c.br.y;

      const stepX = (rx - lx) / denomW;
      const stepY = (ry - ly) / denomW;

      let curX = lx;
      let baseCurY = ly;

      for (let u = 0; u < dstW; u++) {
        const sx = curX;
        const sy = baseCurY + gutterOffsets[u];

        curX += stepX;
        baseCurY += stepY;

        if (sx >= 0 && sx < srcW - 1 && sy >= 0 && sy < srcH - 1) {
          const x0 = sx | 0;
          const y0 = sy | 0;
          const fx = sx - x0;
          const fy = sy - y0;
          const w00 = (1 - fx) * (1 - fy);
          const w10 = fx * (1 - fy);
          const w01 = (1 - fx) * fy;
          const w11 = fx * fy;

          const idx00 = (y0 * srcW + x0) << 2;
          const idx10 = idx00 + 4;
          const idx01 = idx00 + srcStride;
          const idx11 = idx01 + 4;

          outData[outIdx]     = (srcData[idx00]     * w00 + srcData[idx10]     * w10 + srcData[idx01]     * w01 + srcData[idx11]     * w11 + 0.5) | 0;
          outData[outIdx + 1] = (srcData[idx00 + 1] * w00 + srcData[idx10 + 1] * w10 + srcData[idx01 + 1] * w01 + srcData[idx11 + 1] * w11 + 0.5) | 0;
          outData[outIdx + 2] = (srcData[idx00 + 2] * w00 + srcData[idx10 + 2] * w10 + srcData[idx01 + 2] * w01 + srcData[idx11 + 2] * w11 + 0.5) | 0;
          outData[outIdx + 3] = 255;
        } else {
          outData[outIdx]     = 246;
          outData[outIdx + 1] = 244;
          outData[outIdx + 2] = 238;
          outData[outIdx + 3] = 255;
        }
        outIdx += 4;
      }
    }

    outCtx.putImageData(outImgData, 0, 0);
    return outCanvas;
  }
}