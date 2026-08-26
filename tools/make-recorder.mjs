/* Generates hero.glb — the flight recorder, parametrically.
 *
 *   node tools/make-recorder.mjs
 *
 * WHY NOT IMAGE-TO-3D. Tried twice on the rig with TRELLIS, and both runs
 * produced the same thing: a soft melted box with the ports smeared into
 * craters and the corner brackets rounded into lumps. That is not a settings
 * problem. Reconstruction infers a surface from pixels, and inference rounds
 * exactly the edges that make a machined object read as machined. It is very
 * good at organic form and bad at intentional corners.
 *
 * A flight recorder is parametric: a chamfered shell, a recessed panel with
 * real inset walls, heat-sink fins, corner brackets, a carry handle, lamp
 * bezels, bolts. Built from numbers, every edge is exact and stays exact when
 * the camera moves. It also costs a fraction of the bytes.
 *
 * Output is a plain glTF 2.0 binary: one mesh, TRIANGLES, POSITION + NORMAL +
 * COLOR_0. COLOR_0 carries no colour — its red channel is the LAMP MASK, which
 * is how the page's shader knows which faces are lenses and should be lit.
 * Piggybacking on a standard attribute keeps the file loadable by any viewer.
 */
import { writeFileSync } from "node:fs";

const P = [], N = [], C = [];

function push(a, b, c, n, lamp) {
  for (const v of [a, b, c]) {
    P.push(v[0], v[1], v[2]);
    N.push(n[0], n[1], n[2]);
    C.push(lamp, 0, 0, 1);
  }
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
function faceNormal(a, b, c) {
  const u = sub(b, a), v = sub(c, a);
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(...n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}
function quad(a, b, c, d, lamp = 0) {
  const n = faceNormal(a, b, c);
  push(a, b, c, n, lamp);
  push(a, c, d, n, lamp);
}

/** Chamfered box. The chamfer is the whole point: a hard-surface object reads as
 *  machined because its edges catch a highlight, and a plain cube cannot. */
function box(sx, sy, sz, cx, cy, cz, ch = 0, lamp = 0) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const c = Math.min(ch, hx * 0.9, hy * 0.9, hz * 0.9);
  const at = (x, y, z) => [cx + x, cy + y, cz + z];
  const h = [hx, hy, hz];

  for (let ax = 0; ax < 3; ax++) {
    const u = (ax + 1) % 3, v = (ax + 2) % 3;
    for (const s of [-1, 1]) {
      const corner = (su, sv) => {
        const p = [0, 0, 0];
        p[ax] = h[ax] * s; p[u] = (h[u] - c) * su; p[v] = (h[v] - c) * sv;
        return at(...p);
      };
      const pts = s > 0 ? [corner(-1,-1), corner(1,-1), corner(1,1), corner(-1,1)]
                        : [corner(-1,1), corner(1,1), corner(1,-1), corner(-1,-1)];
      quad(...pts, lamp);
    }
  }
  if (c <= 0) return;
  for (let ax = 0; ax < 3; ax++) {
    const u = (ax + 1) % 3, v = (ax + 2) % 3;
    for (const su of [-1, 1]) for (const sv of [-1, 1]) {
      const mk = (e, which) => {
        const p = [0, 0, 0];
        p[ax] = e;
        if (which === 0) { p[u] = h[u] * su; p[v] = (h[v] - c) * sv; }
        else { p[u] = (h[u] - c) * su; p[v] = h[v] * sv; }
        return at(...p);
      };
      const e = h[ax] - c;
      const A = mk(-e, 0), B = mk(-e, 1), Cc = mk(e, 1), D = mk(e, 0);
      if (su * sv > 0) quad(A, B, Cc, D, lamp); else quad(D, Cc, B, A, lamp);
    }
  }
  for (const sx2 of [-1, 1]) for (const sy2 of [-1, 1]) for (const sz2 of [-1, 1]) {
    const q0 = at((hx - c) * sx2, hy * sy2, hz * sz2);
    const q1 = at(hx * sx2, (hy - c) * sy2, hz * sz2);
    const q2 = at(hx * sx2, hy * sy2, (hz - c) * sz2);
    const n = faceNormal(q0, q1, q2);
    const flip = sx2 * sy2 * sz2 > 0;
    if (flip) push(q0, q1, q2, n, lamp); else push(q2, q1, q0, faceNormal(q2, q1, q0), lamp);
  }
}

/** Cylinder along +z, optionally faceted low for a bolt head. */
function cyl(r, len, cx, cy, cz, seg = 24, lamp = 0, capLamp = null) {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const x0 = Math.cos(a0) * r, y0 = Math.sin(a0) * r;
    const x1 = Math.cos(a1) * r, y1 = Math.sin(a1) * r;
    quad([cx + x0, cy + y0, cz], [cx + x1, cy + y1, cz],
         [cx + x1, cy + y1, cz + len], [cx + x0, cy + y0, cz + len], lamp);
    const n = [0, 0, 1];
    push([cx, cy, cz + len], [cx + x0, cy + y0, cz + len], [cx + x1, cy + y1, cz + len],
         n, capLamp === null ? lamp : capLamp);
    push([cx, cy, cz], [cx + x1, cy + y1, cz], [cx + x0, cy + y0, cz], [0, 0, -1], lamp);
  }
}

/* ── the object ──────────────────────────────────────────────────────────
   Roughly 1.0 x 0.62 x 0.46 so it sits in the same envelope the page's camera
   was framed for. */
const BW = 1.00, BH = 0.60, BD = 0.46;

box(BW, BH, BD, 0, 0, 0, 0.045);                       // shell
box(BW * 1.03, 0.13, BD * 1.06, 0, -0.02, 0, 0.022);   // mounting strap

// Recessed front panel: a real inset, built as a floor set back behind four
// walls. A plate stuck on the front reads as a sticker; a recess reads as a bay.
const PW = 0.46, PH = 0.30, PZ = BD / 2, DEP = 0.035, PX = 0.22, PY = 0.05;
box(PW, PH, 0.012, PX, PY, PZ - DEP, 0);                        // recess floor
box(PW + 0.06, 0.03, DEP, PX, PY + PH / 2 + 0.015, PZ - DEP / 2, 0.006);
box(PW + 0.06, 0.03, DEP, PX, PY - PH / 2 - 0.015, PZ - DEP / 2, 0.006);
box(0.03, PH + 0.06, DEP, PX - PW / 2 - 0.015, PY, PZ - DEP / 2, 0.006);
box(0.03, PH + 0.06, DEP, PX + PW / 2 + 0.015, PY, PZ - DEP / 2, 0.006);

// Data slots inside the recess — the readable "instrument" detail.
for (let i = 0; i < 5; i++) {
  box(PW - 0.10, 0.016, 0.010, PX, PY + 0.10 - i * 0.05, PZ - DEP + 0.010, 0.003);
}

// Heat-sink fins across the top: fine, repeated, catch the light in a row.
for (let i = 0; i < 11; i++) {
  box(0.022, 0.055, BD * 0.74, -0.40 + i * 0.028, BH / 2 + 0.022, -0.02, 0.004);
}

// Corner brackets — two plates per corner, which is what makes a case look rugged.
for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
  box(0.14, 0.028, BD * 1.02, sx * (BW / 2 - 0.07), sy * (BH / 2 - 0.014), 0, 0.006);
  box(0.028, 0.13, BD * 1.02, sx * (BW / 2 - 0.014), sy * (BH / 2 - 0.065), 0, 0.006);
}

// Carry handle: a bar on two standoffs.
box(0.05, 0.05, 0.045, -0.13, BH / 2 + 0.055, 0, 0.012);
box(0.05, 0.05, 0.045, 0.13, BH / 2 + 0.055, 0, 0.012);
box(0.33, 0.042, 0.055, 0, BH / 2 + 0.088, 0, 0.018);

// Lamp bezels, with a lens face that the page's shader lights.
cyl(0.062, 0.030, -0.30, 0.16, BD / 2, 26, 0, 0);
cyl(0.044, 0.016, -0.30, 0.16, BD / 2 + 0.030, 26, 0, 1);   // lit lens
cyl(0.062, 0.030, -0.30, -0.13, BD / 2, 26, 0, 0);
cyl(0.044, 0.016, -0.30, -0.13, BD / 2 + 0.030, 26, 0, 0.22);

// A connector port and its collar, low on the left of the face.
cyl(0.052, 0.034, -0.30, -0.02, BD / 2, 22, 0, 0);
cyl(0.032, 0.020, -0.30, -0.02, BD / 2 + 0.034, 18, 0, 0);

// Hex bolts around the face.
for (const [x, y] of [[-0.44, 0.24], [-0.44, -0.24], [0.46, 0.24], [0.46, -0.24]]) {
  cyl(0.020, 0.014, x, y, BD / 2, 6, 0, 0);
}

/* ── write the GLB ───────────────────────────────────────────────────── */
const pos = new Float32Array(P), nrm = new Float32Array(N), col = new Float32Array(C);
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) {
  if (pos[i + k] < min[k]) min[k] = pos[i + k];
  if (pos[i + k] > max[k]) max[k] = pos[i + k];
}

const pad4 = (n) => (4 - (n % 4)) % 4;
const parts = [Buffer.from(pos.buffer), Buffer.from(nrm.buffer), Buffer.from(col.buffer)];
const offs = [];
let cur = 0;
for (const p of parts) { offs.push(cur); cur += p.length; }
const bin = Buffer.concat(parts, cur);

const count = pos.length / 3;
const gltf = {
  asset: { version: "2.0", generator: "whyidied make-recorder.mjs" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: "recorder" }],
  meshes: [{ name: "recorder", primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, mode: 4 }] }],
  buffers: [{ byteLength: bin.length }],
  bufferViews: [
    { buffer: 0, byteOffset: offs[0], byteLength: parts[0].length, target: 34962 },
    { buffer: 0, byteOffset: offs[1], byteLength: parts[1].length, target: 34962 },
    { buffer: 0, byteOffset: offs[2], byteLength: parts[2].length, target: 34962 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count, type: "VEC3", min, max },
    { bufferView: 1, componentType: 5126, count, type: "VEC3" },
    { bufferView: 2, componentType: 5126, count, type: "VEC4" },
  ],
};

const jsonBuf = Buffer.from(JSON.stringify(gltf), "utf8");
const jsonPad = Buffer.alloc(pad4(jsonBuf.length), 0x20);
const binPad = Buffer.alloc(pad4(bin.length), 0);
const jsonChunk = Buffer.concat([jsonBuf, jsonPad]);
const binChunk = Buffer.concat([bin, binPad]);

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonChunk.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(binChunk.length, 0); bh.writeUInt32LE(0x004e4942, 4);

const out = Buffer.concat([header, jh, jsonChunk, bh, binChunk]);
writeFileSync(new URL("../hero.glb", import.meta.url), out);
console.log(`hero.glb  ${(out.length / 1024).toFixed(0)} KB  ${count / 3} triangles`);
console.log(`bounds    ${min.map((n) => n.toFixed(2)).join(", ")}  ->  ${max.map((n) => n.toFixed(2)).join(", ")}`);
