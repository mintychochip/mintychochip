// GIF89a encoder: one global palette, infinite loop, and per-frame deltas
// (only the changed rectangle is stored, with unchanged pixels made
// transparent when that compresses better).

export function encodeGif({ width, height, palette, frames, delay }) {
  let bits = 1;
  while (1 << bits < palette.length + 1) bits++;
  const transparent = palette.length;
  const minCodeSize = Math.max(2, bits);
  const out = new Writer();

  out.text('GIF89a');
  out.u16(width);
  out.u16(height);
  out.u8(0xf0 | (bits - 1));
  out.u8(0);
  out.u8(0);
  for (let i = 0; i < 1 << bits; i++) out.bytes(palette[i] ?? [0, 0, 0]);
  out.bytes([0x21, 0xff, 0x0b]);
  out.text('NETSCAPE2.0');
  out.bytes([0x03, 0x01, 0x00, 0x00, 0x00]);

  let prev = null;
  for (const frame of frames) {
    let rect = { x: 0, y: 0, w: width, h: height };
    let data;
    let masked = false;
    if (!prev) {
      data = lzw(frame, minCodeSize);
    } else {
      rect = changedRect(prev, frame, width, height) ?? { x: 0, y: 0, w: 1, h: 1 };
      const plain = lzw(crop(frame, width, rect), minCodeSize);
      const holes = lzw(crop(frame, width, rect, prev, transparent), minCodeSize);
      masked = holes.length < plain.length;
      data = masked ? holes : plain;
    }

    out.bytes([0x21, 0xf9, 0x04, 0x04 | (masked ? 1 : 0)]);
    out.u16(delay);
    out.u8(masked ? transparent : 0);
    out.u8(0);

    out.u8(0x2c);
    out.u16(rect.x);
    out.u16(rect.y);
    out.u16(rect.w);
    out.u16(rect.h);
    out.u8(0);

    out.u8(minCodeSize);
    for (let i = 0; i < data.length; i += 255) {
      const block = data.subarray(i, i + 255);
      out.u8(block.length);
      out.bytes(block);
    }
    out.u8(0);
    prev = frame;
  }
  out.u8(0x3b);
  return out.done();
}

function changedRect(a, b, width, height) {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (a[row + x] === b[row + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function crop(frame, width, { x, y, w, h }, prev, transparent) {
  const out = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    const row = (y + j) * width + x;
    for (let i = 0; i < w; i++) {
      const p = frame[row + i];
      out[j * w + i] = prev && prev[row + i] === p ? transparent : p;
    }
  }
  return out;
}

function lzw(pixels, minCodeSize) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  const table = new Int16Array(4096 << minCodeSize);
  const out = new Writer();
  let codeSize;
  let next;
  let acc = 0;
  let accBits = 0;

  const emit = (code) => {
    acc |= code << accBits;
    accBits += codeSize;
    while (accBits >= 8) {
      out.u8(acc & 0xff);
      acc >>>= 8;
      accBits -= 8;
    }
  };
  const reset = () => {
    table.fill(-1);
    codeSize = minCodeSize + 1;
    next = eoi + 1;
  };

  reset();
  emit(clear);
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i];
    const key = (prefix << minCodeSize) | k;
    if (table[key] !== -1) {
      prefix = table[key];
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      table[key] = next++;
      if (next > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      reset();
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (accBits > 0) out.u8(acc & 0xff);
  return out.done();
}

class Writer {
  buf = new Uint8Array(1 << 16);
  len = 0;

  reserve(n) {
    if (this.len + n <= this.buf.length) return;
    const grown = new Uint8Array(Math.max(this.buf.length * 2, this.len + n));
    grown.set(this.buf.subarray(0, this.len));
    this.buf = grown;
  }

  u8(v) {
    this.reserve(1);
    this.buf[this.len++] = v;
  }

  u16(v) {
    this.u8(v & 0xff);
    this.u8(v >> 8);
  }

  bytes(a) {
    this.reserve(a.length);
    this.buf.set(a, this.len);
    this.len += a.length;
  }

  text(s) {
    for (const c of s) this.u8(c.charCodeAt(0));
  }

  done() {
    return this.buf.subarray(0, this.len);
  }
}
