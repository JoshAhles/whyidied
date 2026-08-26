/* Converts a sourced GLB into a geometry-only hero asset.
 *
 *   node tools/prep-camera.mjs <source.glb> [--no-tripod]
 *
 * SOURCE: "AntiqueCamera" by Maximilian Kamps / UX3D, from the Khronos
 * glTF-Sample-Assets repository. Licensed **CC0 1.0 Universal** — a public
 * domain dedication, so no attribution is legally required. Credited anyway in
 * the page footer, because taking someone's work and saying nothing is a poor
 * way to behave even when it is permitted.
 *
 * WHY STRIP IT. The original is 16.7 MB, and almost all of that is six textures
 * of brown leather and brass. Three problems solved by one decision:
 *   1. WEIGHT. 16.7 MB on a landing page whose own argument is that load time
 *      matters would be indefensible.
 *   2. PALETTE. Brown leather fights a gunmetal-and-amber identity. Our shader
 *      gives it the same machined material every other surface in the brand has,
 *      so it looks like it belongs to us rather than like a stock asset dropped
 *      in.
 *   3. THE LOGO. The model's README notes a UX3D trademark marking. It lives in
 *      the texture, so removing textures removes it — we are not shipping
 *      someone else's mark on our hero.
 *
 * Node transforms are BAKED into the vertices. The source parents its meshes
 * under nodes that carry rotation and scale, and a loader that ignores them
 * renders the camera lying on its side inside its own tripod.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [, , src, ...flags] = process.argv;
if (!src) { console.error("usage: node tools/prep-camera.mjs <source.glb> [--no-tripod]"); process.exit(2); }
const noTripod = flags.includes("--no-tripod");
// The source packs the centre column AND a floor plate into the mesh it calls
// "camera", so dropping the tripod NODE still leaves a 7-unit-tall object with
// the actual camera in the top quarter. A height cut is the honest fix: keep the
// triangles that are the camera.
const aboveArg = flags.find((f) => f.startsWith("--above="));
const ABOVE = aboveArg ? parseFloat(aboveArg.split("=")[1]) : -Infinity;

/* SPLIT THE HOUSING FROM THE MOUNT so the page can move one without the other.
 * A security camera twitches on its bracket; the bracket is bolted to a wall and
 * does not move. Rotating the whole object reads as someone waving it around.
 *
 * The source ships one mesh, so the split is geometric — and it is not a guess.
 * Measuring X width per height slice: below y=0.10 every slice is 0.055-0.083
 * wide (the wall plate and the arm), above it they widen to 0.13-0.17 (the
 * barrel). The narrow band at y~0.077 is the knuckle, whose centroid is the
 * pivot. `--split=` and `--pivot=` keep those numbers out of the code. */
const splitArg = flags.find((f) => f.startsWith("--split="));
const SPLIT = splitArg ? parseFloat(splitArg.split("=")[1]) : null;
const pivotArg = flags.find((f) => f.startsWith("--pivot="));
const PIVOT = pivotArg ? pivotArg.split("=")[1].split(",").map(Number) : [0, 0, 0];

// Accepts a .glb OR a .gltf with an external .bin, because the two good CC0
// sources publish in different shapes: Khronos ships binary, Poly Haven ships
// gltf plus a sidecar buffer.
let buf, json;
if (src.toLowerCase().endsWith(".gltf")) {
  json = JSON.parse(readFileSync(src, "utf8"));
  const uri = json.buffers[0].uri;
  if (!uri || uri.startsWith("data:")) throw new Error("embedded buffers not supported");
  buf = readFileSync(new URL(decodeURIComponent(uri), pathToFileURL(src)));
} else {
  const raw = readFileSync(src);
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("not a GLB");
  let off = 12, b = null;
  while (off < dv.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    const body = raw.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body));
    else if (type === 0x004e4942) b = body;
    off += 8 + len + ((4 - (len % 4)) % 4);
  }
  buf = b;
}
if (!json || !buf) throw new Error("could not read geometry");

const CTOR = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function read(idx) {
  const acc = json.accessors[idx];
  const bv = json.bufferViews[acc.bufferView];
  const C = CTOR[acc.componentType], n = COMPS[acc.type];
  const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = bv.byteStride;
  const at = buf.byteOffset + base;
  if (!stride || stride === n * C.BYTES_PER_ELEMENT) return new C(buf.buffer, at, acc.count * n);
  const out = new C(acc.count * n);
  for (let i = 0; i < acc.count; i++) {
    const row = new C(buf.buffer, at + i * stride, n);
    for (let j = 0; j < n; j++) out[i * n + j] = row[j];
  }
  return out;
}

/* ---- node transforms, composed down the tree ------------------------- */
const ident = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
function trs(node) {
  if (node.matrix) return node.matrix.slice();
  const m = ident();
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  const R = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
  ];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) m[c * 4 + r] = R[c * 3 + r] * [sx, sy, sz][c];
  const t = node.translation || [0, 0, 0];
  m[12] = t[0]; m[13] = t[1]; m[14] = t[2];
  return m;
}
const xf = (m, v) => [
  m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
  m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
  m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
];
const xfN = (m, v) => {   // normals ignore translation; uniform scale assumed
  const o = [m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
             m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
             m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];
  const l = Math.hypot(...o) || 1;
  return [o[0] / l, o[1] / l, o[2] / l];
};

const P = [], N = [], UV = [], PART = [];
const scene = json.scenes[json.scene || 0];
function walk(nodeIdx, parent) {
  const node = json.nodes[nodeIdx];
  const world = mul(parent, trs(node));
  if (node.mesh !== undefined) {
    const mesh = json.meshes[node.mesh];
    const name = (mesh.name || "").toLowerCase();
    if (!(noTripod && name.includes("tripod"))) {
      for (const prim of mesh.primitives) {
        if (prim.mode !== undefined && prim.mode !== 4) continue;
        const pos = read(prim.attributes.POSITION);
        const nrm = prim.attributes.NORMAL !== undefined ? read(prim.attributes.NORMAL) : null;
        const uv = prim.attributes.TEXCOORD_0 !== undefined ? read(prim.attributes.TEXCOORD_0) : null;
        const idx = prim.indices !== undefined ? read(prim.indices) : null;
        const n = idx ? idx.length : pos.length / 3;
        // Whole triangles only: cutting per-vertex would leave torn faces.
        for (let i = 0; i + 2 < n; i += 3) {
          const tri = [];
          for (let k = 0; k < 3; k++) {
            const v = idx ? idx[i + k] : i + k;
            tri.push({
              p: xf(world, [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]),
              n: nrm ? xfN(world, [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]]) : [0, 1, 0],
              t: uv ? [uv[v * 2], uv[v * 2 + 1]] : [0, 0],
            });
          }
          // KEEP only triangles wholly above the cut. Dropping just the ones
          // wholly below leaves the faces that SPAN the cut, and a face reaching
          // from the camera down to the base plate renders as a long needle —
          // which is exactly what appeared on the page.
          if (!tri.every((t) => t.p[1] >= ABOVE)) continue;
          // Whole triangles again: a face split between the two parts would tear
          // open the moment the housing moves.
          const cy = (tri[0].p[1] + tri[1].p[1] + tri[2].p[1]) / 3;
          const part = SPLIT !== null && cy >= SPLIT ? 1 : 0;
          for (const t of tri) {
            P.push(t.p[0], t.p[1], t.p[2]);
            N.push(t.n[0], t.n[1], t.n[2]);
            UV.push(t.t[0], t.t[1]);
            PART.push(part);
          }
        }
      }
    }
  }
  for (const c of node.children || []) walk(c, world);
}
for (const n of scene.nodes) walk(n, ident());

if (!P.length) throw new Error("no geometry survived — check --no-tripod");

/* ---- INDEX THE GEOMETRY ---------------------------------------------
 * Emitting three unique vertices per triangle is the simple thing, and it makes
 * the buffer roughly three times larger than it needs to be — 1.86 MB of the
 * 3.17 MB asset. Deduplicating on the full vertex (position, normal, uv, part)
 * keeps every hard edge, because a hard edge IS two vertices with different
 * normals and they will not merge. Quantised to 1e-5 so float noise from the
 * transform bake does not defeat the match.
 */
const q = (x) => Math.round(x * 100000) / 100000;
const seen = new Map();
const iP = [], iN = [], iUV = [], iPART = [], IDX = [];
for (let v = 0; v < P.length / 3; v++) {
  const key = [
    q(P[v*3]), q(P[v*3+1]), q(P[v*3+2]),
    q(N[v*3]), q(N[v*3+1]), q(N[v*3+2]),
    q(UV[v*2] || 0), q(UV[v*2+1] || 0),
    PART[v] || 0,
  ].join(",");
  let at = seen.get(key);
  if (at === undefined) {
    at = iP.length / 3;
    seen.set(key, at);
    iP.push(P[v*3], P[v*3+1], P[v*3+2]);
    iN.push(N[v*3], N[v*3+1], N[v*3+2]);
    iUV.push(UV[v*2] || 0, UV[v*2+1] || 0);
    iPART.push(PART[v] || 0);
  }
  IDX.push(at);
}
console.log(`indexed   ${P.length/3} vertices -> ${iP.length/3} unique (${(100 - iP.length/P.length*100).toFixed(0)}% fewer)`);
P.length = 0; P.push(...iP);
N.length = 0; N.push(...iN);
UV.length = 0; UV.push(...iUV);
PART.length = 0; PART.push(...iPART);

/* ---- write a lean geometry-only GLB ---------------------------------- */
const pos = new Float32Array(P), nrm = new Float32Array(N);
const col = new Float32Array((P.length / 3) * 4);
for (let i = 0, v = 0; i < col.length; i += 4, v++) {
  col[i] = 0;              // red: lamp mask, none on a sourced model
  col[i + 1] = PART[v] || 0;   // green: 1 = housing, 0 = mount
  col[i + 3] = 1;
}

const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) {
  if (pos[i + k] < min[k]) min[k] = pos[i + k];
  if (pos[i + k] > max[k]) max[k] = pos[i + k];
}

/* ---- textures, embedded ---------------------------------------------
 * STRIPPING THEM WAS A MISTAKE. A bare mesh lit by a shader tuned for a
 * machined box looks exactly like what it is, and Josh said so immediately.
 * The maps are what make this read as an object rather than a grey blob, and at
 * ~1 MB for all three they are affordable on a page that has already dropped
 * 150 KB of libraries.
 *
 * Order is fixed — baseColor, ARM, normal — so the page does not have to walk
 * the material graph to find out which is which.
 */
const texArg = flags.find((f) => f.startsWith("--textures="));
const texDir = texArg ? texArg.split("=")[1] : null;
const texFiles = [];
if (texDir) {
  const { readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const all = readdirSync(texDir);
  for (const want of ["diff", "arm", "nor"]) {
    const f = all.find((x) => x.includes(want) && /\.(jpe?g|png)$/i.test(x));
    if (!f) throw new Error("missing a " + want + " map in " + texDir);
    texFiles.push({ name: f, data: readFileSync(join(texDir, f)),
                    mime: /\.png$/i.test(f) ? "image/png" : "image/jpeg" });
  }
}

const uvArr = new Float32Array(UV);
const pad4 = (n) => (4 - (n % 4)) % 4;
const idxArr = iP.length / 3 > 65535 ? new Uint32Array(IDX) : new Uint16Array(IDX);
const parts = [Buffer.from(pos.buffer), Buffer.from(nrm.buffer), Buffer.from(col.buffer),
               Buffer.from(uvArr.buffer), Buffer.from(idxArr.buffer)];
for (const t of texFiles) parts.push(t.data, Buffer.alloc(pad4(t.data.length), 0));
const offs = []; let cur = 0;
for (const p of parts) { offs.push(cur); cur += p.length; }
const binOut = Buffer.concat(parts, cur);
const count = pos.length / 3;

const gltf = {
  asset: { version: "2.0", generator: "whyidied prep-camera.mjs",
           copyright: "AntiqueCamera geometry by Maximilian Kamps / UX3D, CC0 1.0. Textures and materials removed." },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: "hero" }],
  meshes: [{ name: "hero", primitives: [{ attributes: {}, mode: 4 }] }],
  buffers: [{ byteLength: binOut.length }],
  bufferViews: [],
  accessors: [],
};
// Attribute views first, then the index view, then one view per embedded image.
for (let i = 0; i < 4; i++) {
  gltf.bufferViews.push({ buffer: 0, byteOffset: offs[i], byteLength: parts[i].length, target: 34962 });
}
gltf.bufferViews.push({ buffer: 0, byteOffset: offs[4], byteLength: parts[4].length, target: 34963 });

const prim = gltf.meshes[0].primitives[0];
const push = (acc) => (gltf.accessors.push(acc), gltf.accessors.length - 1);
prim.attributes.POSITION = push({ bufferView: 0, componentType: 5126, count, type: "VEC3", min, max });
prim.attributes.NORMAL   = push({ bufferView: 1, componentType: 5126, count, type: "VEC3" });
prim.attributes.COLOR_0  = push({ bufferView: 2, componentType: 5126, count, type: "VEC4" });
if (texFiles.length) prim.attributes.TEXCOORD_0 = push({ bufferView: 3, componentType: 5126, count, type: "VEC2" });
prim.indices = push({ bufferView: 4, componentType: idxArr.BYTES_PER_ELEMENT === 4 ? 5125 : 5123,
                      count: IDX.length, type: "SCALAR" });
if (texFiles.length) prim.material = 0;
if (texFiles.length) {
  gltf.images = []; gltf.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  gltf.textures = []; 
  texFiles.forEach((t, i) => {
    const vi = gltf.bufferViews.length;
    gltf.bufferViews.push({ buffer: 0, byteOffset: offs[5 + i * 2], byteLength: t.data.length });
    gltf.images.push({ bufferView: vi, mimeType: t.mime, name: t.name });
    gltf.textures.push({ sampler: 0, source: i });
  });
  gltf.materials = [{
    name: "hero",
    pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 1 } },
    normalTexture: { index: 2 },
    extras: { maps: ["baseColor", "arm", "normal"],
              parts: "COLOR_0.g: 1 = housing, 0 = mount",
              pivot: PIVOT },
  }];
}

const jb = Buffer.from(JSON.stringify(gltf), "utf8");
const jc = Buffer.concat([jb, Buffer.alloc(pad4(jb.length), 0x20)]);
const bc = Buffer.concat([binOut, Buffer.alloc(pad4(binOut.length), 0)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jc.length + 8 + bc.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jc.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(bc.length, 0); bh.writeUInt32LE(0x004e4942, 4);

const out = Buffer.concat([header, jh, jc, bh, bc]);
writeFileSync(new URL("../hero.glb", import.meta.url), out);
console.log(`hero.glb  ${(out.length / 1024 / 1024).toFixed(2)} MB  ${IDX.length / 3} triangles, ${count} vertices${noTripod ? "  (tripod dropped)" : ""}`);
console.log(`bounds    ${min.map((n) => n.toFixed(2)).join(", ")}  ->  ${max.map((n) => n.toFixed(2)).join(", ")}`);

/* ---- VALIDATE WHAT WAS WRITTEN --------------------------------------
 * An earlier version of this file hard-coded the accessor indices on the
 * primitive (TEXCOORD_0: 3, indices: 4) while pushing the accessors in a
 * different order, so the index accessor took slot 3 and UV took slot 4. The
 * loader then read UV floats as vertex indices and the hero rendered as
 * nothing — and it shipped, because a malformed glTF is still a well-formed
 * FILE. Nothing downstream can catch this; the only place that can is here.
 */
{
  const check = [];
  const A = gltf.accessors, P0 = gltf.meshes[0].primitives[0];
  const want = { POSITION: "VEC3", NORMAL: "VEC3", COLOR_0: "VEC4", TEXCOORD_0: "VEC2" };
  for (const [k, t] of Object.entries(want)) {
    if (P0.attributes[k] === undefined) continue;
    if (A[P0.attributes[k]].type !== t) check.push(`${k} is ${A[P0.attributes[k]].type}, expected ${t}`);
    if (A[P0.attributes[k]].count !== count) check.push(`${k} count ${A[P0.attributes[k]].count} != ${count}`);
  }
  const ia = A[P0.indices];
  if (!ia || ia.type !== "SCALAR") check.push("indices accessor is not SCALAR");
  else {
    if (![5123, 5125].includes(ia.componentType)) check.push("indices are not an integer type");
    if (ia.count % 3) check.push(`index count ${ia.count} is not a multiple of 3`);
    let mx = 0;
    for (let i = 0; i < IDX.length; i++) if (IDX[i] > mx) mx = IDX[i];
    if (mx >= count) check.push(`max index ${mx} addresses vertex ${mx} of ${count}`);
    if (ia.componentType === 5123 && mx > 65535) check.push("max index exceeds Uint16");
  }
  if (check.length) {
    console.error("REFUSING TO WRITE — the glTF this would produce is invalid:");
    for (const c of check) console.error("  " + c);
    process.exit(1);
  }
  console.log(`validated ${count} vertices, ${IDX.length / 3} triangles, every index in range`);
}
