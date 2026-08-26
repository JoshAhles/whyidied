/* WhyIDied — landing page motion.
 *
 * NO LIBRARIES, deliberately. The previous page pulled GSAP, ScrollTrigger,
 * Lenis and Chart.js from a CDN — about 150 KB across three third-party origins
 * for effects the platform now does natively. Distribution is the binding
 * constraint on this product, so load time is a feature, not hygiene.
 *
 * The hero recorder is generated in code: a chamfered body, a recessed panel,
 * lamp bezels and a strap band, with a computed metal material. Zero bytes are
 * downloaded for it. This repeats a decision already made and paid for in the
 * app: a reconstructed mesh of this object came back as a soft lumpy pillow,
 * because single-image photogrammetry is good at organic form and bad at
 * intentional edges. A flight recorder is parametric. Built, it has crisp edges
 * by construction.
 *
 * Everything animated is GOVERNED: `gs` on <html> is absent under
 * prefers-reduced-motion or ?noanim, and every loop below renders one correct
 * static frame instead of nothing.
 */
(function () {
  "use strict";
  var MOTION = document.documentElement.classList.contains("gs");

  /* ── year, form ──────────────────────────────────────────────────── */
  var yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();

  var form = document.querySelector("form[data-endpoint]");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = form.parentNode.querySelector(".formmsg");
      var input = form.querySelector("input[type=email]");
      var btn = form.querySelector("button");
      if (!input.value || input.value.indexOf("@") < 0) {
        msg.style.color = "var(--fault)";
        msg.textContent = "That address does not look right.";
        return;
      }
      btn.disabled = true;
      btn.textContent = "Sending…";
      fetch(form.dataset.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: input.value }),
      })
        .then(function (r) {
          msg.style.color = r.ok ? "var(--ok)" : "var(--fault)";
          msg.textContent = r.ok
            ? "You're on the list. We'll email you once."
            : "Something went wrong — try hello@whyidied.com.";
          if (r.ok) { form.reset(); btn.textContent = "Requested"; }
          else { btn.disabled = false; btn.textContent = "Request access"; }
        })
        .catch(function () {
          msg.style.color = "var(--fault)";
          msg.textContent = "Network error — try hello@whyidied.com.";
          btn.disabled = false;
          btn.textContent = "Request access";
        });
    });
  }

  /* ── entrance ────────────────────────────────────────────────────── */
  var rises = [].slice.call(document.querySelectorAll(".rise"));
  if (!MOTION || !("IntersectionObserver" in window)) {
    rises.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    rises.forEach(function (el) { io.observe(el); });
  }

  /* ── canvas helper: size to the element's box in device pixels ────── */
  function fit(cv) {
    var r = cv.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(r.width * dpr));
    var h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; return true; }
    return false;
  }

  /* ═══════════════════════════════════════════════════════════════════
     THE RECORDER — procedural geometry + computed metal
     ═══════════════════════════════════════════════════════════════════ */
  (function recorder() {
    var cv = document.getElementById("stage");
    if (!cv) return;
    var gl = cv.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!gl) { cv.style.display = "none"; return; }

    /* ---- geometry -------------------------------------------------- */
    var P = [], N = [], A = [];        // position, normal, attrs(lamp, seam)
    function tri(a, b, c, n, at) {
      var v = [a, b, c];
      for (var i = 0; i < 3; i++) {
        P.push(v[i][0], v[i][1], v[i][2]);
        N.push(n[0], n[1], n[2]);
        A.push(at[0], at[1]);
      }
    }
    function quad(a, b, c, d, n, at) { tri(a, b, c, n, at); tri(a, c, d, n, at); }
    function norm(v) {
      var l = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / l, v[1] / l, v[2] / l];
    }

    /* A chamfered box, built explicitly: six inset faces, twelve edge bevels,
       eight corner triangles. The chamfer is what makes it read as machined
       rather than as a cube with a shiny shader. */
    function chamferBox(hx, hy, hz, c, at, seamAxis, off) {
      var h = [hx, hy, hz];
      off = off || [0, 0, 0];
      var mark = P.length;
      var ax, s, u, v, i, j;
      // faces
      for (ax = 0; ax < 3; ax++) {
        u = (ax + 1) % 3; v = (ax + 2) % 3;
        for (s = -1; s <= 1; s += 2) {
          var pts = [];
          var signs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
          if (s < 0) signs.reverse();
          for (i = 0; i < 4; i++) {
            var p = [0, 0, 0];
            p[ax] = h[ax] * s;
            p[u] = (h[u] - c) * signs[i][0];
            p[v] = (h[v] - c) * signs[i][1];
            pts.push(p);
          }
          var n = [0, 0, 0]; n[ax] = s;
          quad(pts[0], pts[1], pts[2], pts[3], n, [at[0], seamAxis === ax ? 1 : 0]);
        }
      }
      // edge bevels
      for (ax = 0; ax < 3; ax++) {
        u = (ax + 1) % 3; v = (ax + 2) % 3;
        for (var su = -1; su <= 1; su += 2) {
          for (var sv = -1; sv <= 1; sv += 2) {
            var a1 = [0, 0, 0], b1 = [0, 0, 0];
            a1[u] = h[u] * su; a1[v] = (h[v] - c) * sv;
            b1[u] = (h[u] - c) * su; b1[v] = h[v] * sv;
            var e = h[ax] - c;
            var p0 = a1.slice(), p1 = b1.slice(), p2 = b1.slice(), p3 = a1.slice();
            p0[ax] = -e; p1[ax] = -e; p2[ax] = e; p3[ax] = e;
            var nn = [0, 0, 0]; nn[u] = su; nn[v] = sv; nn = norm(nn);
            if (su * sv > 0) quad(p0, p1, p2, p3, nn, [at[0], 0]);
            else quad(p3, p2, p1, p0, nn, [at[0], 0]);
          }
        }
      }
      // corners
      for (var sx = -1; sx <= 1; sx += 2)
        for (var sy = -1; sy <= 1; sy += 2)
          for (var sz = -1; sz <= 1; sz += 2) {
            var q0 = [(hx - c) * sx, hy * sy, hz * sz];
            var q1 = [hx * sx, (hy - c) * sy, hz * sz];
            var q2 = [hx * sx, hy * sy, (hz - c) * sz];
            var cn = norm([sx, sy, sz]);
            if (sx * sy * sz > 0) tri(q0, q1, q2, cn, [at[0], 0]);
            else tri(q2, q1, q0, cn, [at[0], 0]);
          }
      // Translate only the vertices this call pushed. Building at the origin and
      // moving afterwards keeps the face/bevel/corner maths free of an offset
      // term in nine places.
      if (off[0] || off[1] || off[2])
        for (var m = mark; m < P.length; m += 3) {
          P[m] += off[0]; P[m + 1] += off[1]; P[m + 2] += off[2];
        }
    }

    function cylinder(cx, cy, cz, r, len, seg, at) {
      // Axis is +z. Used for the lamp bezels, which face the viewer.
      var i, a0, a1, p;
      for (i = 0; i < seg; i++) {
        a0 = (i / seg) * Math.PI * 2; a1 = ((i + 1) / seg) * Math.PI * 2;
        var x0 = Math.cos(a0) * r, y0 = Math.sin(a0) * r;
        var x1 = Math.cos(a1) * r, y1 = Math.sin(a1) * r;
        // wall
        quad([cx + x0, cy + y0, cz], [cx + x1, cy + y1, cz],
             [cx + x1, cy + y1, cz + len], [cx + x0, cy + y0, cz + len],
             norm([Math.cos(a0), Math.sin(a0), 0]), [0, 0]);
        // cap (the lens)
        tri([cx, cy, cz + len], [cx + x0, cy + y0, cz + len], [cx + x1, cy + y1, cz + len],
            [0, 0, 1], at);
      }
    }

    // Body, strap band, mounted panel, two lamp bezels.
    chamferBox(0.88, 0.56, 0.44, 0.055, [0, 0], 1);                       // body, seams on x
    chamferBox(0.855, 0.15, 0.475, 0.035, [0, 0], -1);                     // strap band
    chamferBox(0.30, 0.20, 0.028, 0.012, [0, 0], -1, [0.30, -0.01, 0.445]); // mounted panel
    chamferBox(0.045, 0.17, 0.045, 0.010, [0, 0], -1, [-0.845, 0.30, 0.30]);  // side handle L
    chamferBox(0.045, 0.17, 0.045, 0.010, [0, 0], -1, [0.845, 0.30, 0.30]);   // side handle R
    cylinder(-0.40, 0.30, 0.44, 0.078, 0.038, 26, [1.0, 0]);              // lamp — lit
    cylinder(-0.40, -0.30, 0.44, 0.078, 0.038, 26, [0.20, 0]);            // lamp — dim

    var PROC = { P: P, N: N, A: A };

    /* ---- program --------------------------------------------------- */
    var VS =
      "attribute vec3 aP; attribute vec3 aN; attribute vec2 aA; attribute vec2 aUV;" +
      "uniform mat4 uMVP; uniform mat4 uM;" +
      "varying vec3 vN; varying vec3 vP; varying vec2 vA; varying vec2 vUV;" +
      "void main(){ vN = mat3(uM)*aN; vP = (uM*vec4(aP,1.0)).xyz; vA = aA; vUV = aUV;" +
      " gl_Position = uMVP*vec4(aP,1.0); }";

    var FS =
      "precision highp float;" +
      "varying vec3 vN; varying vec3 vP; varying vec2 vA; varying vec2 vUV;" +
      "uniform vec3 uCam; uniform float uFlick; uniform float uLamps;" +
      "uniform sampler2D uDiff; uniform sampler2D uARM; uniform float uTex; uniform float uDim;" +
      "float h(vec2 p){ return fract(sin(dot(p,vec2(41.7,289.1)))*43758.5453); }" +
      "float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);" +
      " return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }" +
      "void main(){" +
      " vec3 N = normalize(vN); vec3 V = normalize(uCam - vP); vec3 R = reflect(-V,N);" +
      /* Fake studio environment. Cool sky above, dark warm floor below. This is
         the single biggest thing that makes metal read as metal — without it,
         flat-shaded faces look like painted cardboard. */
      " vec3 sky = vec3(0.30,0.36,0.46); vec3 flr = vec3(0.020,0.021,0.024);" +
      " vec3 env = mix(flr, sky, smoothstep(-0.42,0.55,R.y));" +
      " float amb = 0.14 + 0.70*max(dot(N, normalize(vec3(-0.34,0.62,0.85))),0.0);" +
      /* Anisotropic brushed grain: noise stretched along the surface, projected
         on whichever axis the face points down, so streaks run ALONG a panel
         rather than swimming across it. */
      " vec3 an = abs(N); vec2 uv = an.z>an.x&&an.z>an.y ? vP.xy : (an.x>an.y ? vP.zy : vP.xz);" +
      " float grain = n2(vec2(uv.x*90.0, uv.y*3.5))*0.6 + n2(vec2(uv.x*260.0, uv.y*6.0))*0.4;" +
      " float metal = 0.060 + 0.026*grain;" +" vec3 base = vec3(metal); float rough = 0.42; float ao = 1.0; float mtl = 1.0;" +" if(uTex > 0.5){ base = texture2D(uDiff, vUV).rgb;" +"   vec3 arm = texture2D(uARM, vUV).rgb; ao = arm.r; rough = clamp(arm.g,0.05,1.0); mtl = arm.b;" +"   float lum = dot(base, vec3(0.299,0.587,0.114));" +"   base = mix(base, lum*vec3(0.80,0.85,0.97), 0.92); }" +
      /* Panel seams: single-axis grooves with a worn upper lip. Two axes read as
         a waffle; one reads as machining. */
      " float seam = 0.0;" +
      " if(vA.y > 0.5){ float g = abs(fract(vP.x*1.55+0.5)-0.5); seam = smoothstep(0.045,0.0,g); }" +
      " metal *= (1.0 - 0.55*seam);" +
      /* Grime pools on upward faces. */
      " metal *= 1.0 - 0.16*smoothstep(0.25,1.0,N.y)*n2(uv*9.0);" +
      " float fres = pow(1.0 - max(dot(N,V),0.0), 3.4);" +" vec3 L = normalize(vec3(-0.34,0.62,0.85));" +" float spec = pow(max(dot(reflect(-L,N),V),0.0), mix(6.0, 92.0, 1.0-rough));" +" float rim = pow(1.0 - max(dot(N,V),0.0), 6.5) * max(dot(N, normalize(vec3(-0.78,0.30,-0.52))),0.0);" +
      " vec3 col = base*amb*ao + env*mix(0.10, 0.26 + 0.70*fres, mtl)*(1.0 - 0.75*rough);" +
      /* Light spill: the lamps throw amber onto the shell around them, which is
         what makes an emissive read as a light source rather than a sticker. */
      " float d = distance(vP, vec3(-0.40,0.30,0.49));" +
      " col += vec3(1.0,0.70,0.16) * 1.25 * exp(-d*3.4) * uFlick * uLamps;" +
      /* The lamp lenses themselves: hot core, bright bezel ring. */
      " if(vA.x > 0.02){ float lit = vA.x*uFlick;" +
      "   col = mix(col, vec3(1.0,0.78,0.30), 0.86*lit) + vec3(0.55,0.32,0.05)*lit; }" +
      " col += vec3(0.78,0.82,0.90)*spec*mix(0.10, 0.85, 1.0-rough);" +" col += vec3(1.0,0.68,0.20)*rim*mix(0.34, 0.60, uTex);" +" col *= mix(0.30, 0.60, uTex);" +" col = col/(col+0.86); col = pow(col, vec3(0.4545));" +
      " gl_FragColor = vec4(col * (1.0 - uDim*0.82), 1.0 - uDim*0.55); }";

    function sh(t, src) {
      var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { cv.style.display = "none"; return; }
    var pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.style.display = "none"; return; }
    gl.useProgram(pr);

    var COUNT = 0;
    function buf(data, loc, size) {
      var b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data instanceof Float32Array ? data : new Float32Array(data), gl.STATIC_DRAW);
      var l = gl.getAttribLocation(pr, loc);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
    }
    var HAS_LAMPS = 1, HAS_TEX = 0;
    function upload(g, lamps) {
      buf(g.P, "aP", 3); buf(g.N, "aN", 3); buf(g.A, "aA", 2);
      buf(g.UV || new Float32Array((g.P.length / 3) * 2), "aUV", 2);
      COUNT = g.P.length / 3;
      HAS_LAMPS = lamps ? 1 : 0;
    }

    /** Bind one image to a texture unit. The object renders untextured until the
     *  maps decode, which is correct: a hero that waits for 1 MB of JPEG before
     *  showing anything is worse than one that sharpens a moment later. */
    function loadTex(url, unit, uniformName) {
      var tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([90, 90, 90]));
      var img = new Image();
      img.onload = function () {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        var pot = (img.width & (img.width - 1)) === 0 && (img.height & (img.height - 1)) === 0;
        if (pot) {
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        } else {
          // Non-power-of-two cannot wrap or mip in WebGL1; clamping keeps it from
          // rendering black rather than merely soft.
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
      gl.uniform1i(gl.getUniformLocation(pr, uniformName), unit);
    }

    /* ---- GLB geometry, our material ---------------------------------
     * GEOMETRY ONLY, deliberately. The failure that killed the last mesh was not
     * the file format — it was photogrammetry-style geometry and the baked
     * textures that came with it, which turned a machined box into a soft lumpy
     * pillow. Taking positions and normals and lighting them with the shader
     * above keeps whatever form the model actually has while the material stays
     * the brand's, and it means a regenerated model never drags a muddy diffuse
     * map onto the page with it.
     *
     * Supports the subset a single static hero needs: one mesh primitive,
     * TRIANGLES, float POSITION and NORMAL, optional indices. Anything else is
     * refused so the procedural object keeps the hero rather than the page
     * showing a half-parsed mess.
     */
    function parseGLB(ab) {
      var dv = new DataView(ab);
      if (dv.getUint32(0, true) !== 0x46546C67) throw new Error("not a GLB");
      var off = 12, json = null, bin = null;
      while (off < dv.byteLength) {
        var len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
        var body = ab.slice(off + 8, off + 8 + len);
        if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(body));
        else if (type === 0x004E4942) bin = body;
        off += 8 + len + ((4 - (len % 4)) % 4);
      }
      if (!json || !bin) throw new Error("GLB missing a chunk");

      function read(idx) {
        var acc = json.accessors[idx];
        var bv = json.bufferViews[acc.bufferView];
        var comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
        var Ctor = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array,
                     5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[acc.componentType];
        if (!Ctor || !comps) throw new Error("unsupported accessor");
        var base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
        var stride = bv.byteStride;
        if (!stride || stride === comps * Ctor.BYTES_PER_ELEMENT) {
          return new Ctor(bin, base, acc.count * comps);
        }
        // Interleaved: de-stride rather than refuse, since exporters emit it.
        var out = new Ctor(acc.count * comps), i, j;
        for (i = 0; i < acc.count; i++) {
          var row = new Ctor(bin, base + i * stride, comps);
          for (j = 0; j < comps; j++) out[i * comps + j] = row[j];
        }
        return out;
      }

      var prim = json.meshes && json.meshes[0] && json.meshes[0].primitives[0];
      if (!prim) throw new Error("no mesh");
      if (prim.mode !== undefined && prim.mode !== 4) throw new Error("not TRIANGLES");
      if (prim.attributes.POSITION === undefined) throw new Error("no POSITION");

      var pos = read(prim.attributes.POSITION);
      var nrm = prim.attributes.NORMAL !== undefined ? read(prim.attributes.NORMAL) : null;
      var lamp = prim.attributes.COLOR_0 !== undefined ? read(prim.attributes.COLOR_0) : null;
      var uv = prim.attributes.TEXCOORD_0 !== undefined ? read(prim.attributes.TEXCOORD_0) : null;
      var lampStride = lamp && json.accessors[prim.attributes.COLOR_0].type === "VEC3" ? 3 : 4;
      var idx = prim.indices !== undefined ? read(prim.indices) : null;
      var n = idx ? idx.length : pos.length / 3;

      var OP = new Float32Array(n * 3), ON = new Float32Array(n * 3), OA = new Float32Array(n * 2);
      var OU = new Float32Array(n * 2);
      var i, k, v;
      for (i = 0; i < n; i++) {
        v = idx ? idx[i] : i;
        OP[i * 3] = pos[v * 3]; OP[i * 3 + 1] = pos[v * 3 + 1]; OP[i * 3 + 2] = pos[v * 3 + 2];
        if (nrm) { ON[i * 3] = nrm[v * 3]; ON[i * 3 + 1] = nrm[v * 3 + 1]; ON[i * 3 + 2] = nrm[v * 3 + 2]; }
        if (lamp) OA[i * 2] = lamp[v * lampStride];
        if (uv) { OU[i * 2] = uv[v * 2]; OU[i * 2 + 1] = uv[v * 2 + 1]; }
      }
      if (!nrm) {                       // flat normals from the triangles themselves
        for (i = 0; i < n; i += 3) {
          var ax = OP[i*3+3]-OP[i*3], ay = OP[i*3+4]-OP[i*3+1], az = OP[i*3+5]-OP[i*3+2];
          var bx = OP[i*3+6]-OP[i*3], by = OP[i*3+7]-OP[i*3+1], bz = OP[i*3+8]-OP[i*3+2];
          var nx = ay*bz-az*by, ny = az*bx-ax*bz, nz = ax*by-ay*bx;
          var l = Math.hypot(nx,ny,nz) || 1;
          for (k = 0; k < 3; k++) { ON[(i+k)*3] = nx/l; ON[(i+k)*3+1] = ny/l; ON[(i+k)*3+2] = nz/l; }
        }
      }
      // Centre and scale to the same box the procedural object occupies, so the
      // camera, the light spill and the framing do not need retuning per model.
      var lo = [Infinity,Infinity,Infinity], hi = [-Infinity,-Infinity,-Infinity];
      for (i = 0; i < OP.length; i += 3) for (k = 0; k < 3; k++) {
        if (OP[i+k] < lo[k]) lo[k] = OP[i+k];
        if (OP[i+k] > hi[k]) hi[k] = OP[i+k];
      }
      var span = Math.max(hi[0]-lo[0], hi[1]-lo[1], hi[2]-lo[2]) || 1;
      var sc = 1.62 / span;
      for (i = 0; i < OP.length; i += 3) for (k = 0; k < 3; k++)
        OP[i+k] = (OP[i+k] - (lo[k]+hi[k])/2) * sc;
      // Images live in bufferViews, so they come across in the same fetch. A
      // blob URL is the shortest path from those bytes to something an <img>
      // will decode, and the browser does the JPEG work off the main thread.
      var imgs = (json.images || []).map(function (im) {
        var bv = json.bufferViews[im.bufferView];
        var bytes = new Uint8Array(bin, bv.byteOffset || 0, bv.byteLength);
        return URL.createObjectURL(new Blob([bytes], { type: im.mimeType || "image/jpeg" }));
      });
      var lit = false;
      if (lamp) for (var q = 0; q < OA.length; q += 2) if (OA[q] > 0.02) { lit = true; break; }
      return { P: OP, N: ON, A: OA, UV: OU, hasLamps: lit, images: imgs };
    }

    /* The procedural object holds the hero until a model is proven to load. A
       landing page cannot have an empty hero while a file is fetched, and a
       broken parse must not take the section with it. */
    upload(PROC, true);
    // NOT force-cache. The page was loaded several times before hero.glb existed,
    // so force-cache happily replayed the cached 404 and the model never arrived
    // — with no error to show for it, because a 404 is a successful fetch.
    fetch("hero.glb")
      .then(function (r) { if (!r.ok) throw new Error("no hero.glb (" + r.status + ")"); return r.arrayBuffer(); })
      .then(function (ab) {
        var g = parseGLB(ab);
        upload(g, g.hasLamps);
        if (g.images && g.images.length >= 2) {
          loadTex(g.images[0], 0, "uDiff");
          loadTex(g.images[1], 1, "uARM");
          HAS_TEX = 1;
        }
        console.log("hero: hero.glb loaded,", g.P.length / 9, "triangles");
      })
      .catch(function (e) { console.log("hero: procedural (" + e.message + ")"); });

    var uMVP = gl.getUniformLocation(pr, "uMVP"),
        uM = gl.getUniformLocation(pr, "uM"),
        uCam = gl.getUniformLocation(pr, "uCam"),
        uFlick = gl.getUniformLocation(pr, "uFlick"),
        uLamps = gl.getUniformLocation(pr, "uLamps"),
        uTex = gl.getUniformLocation(pr, "uTex"),
        uDim = gl.getUniformLocation(pr, "uDim");

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // NOT culling: the winding rule for chamfer corners was wrong in half the
    // octants, which drew stray triangles off the silhouette. The body is a
    // closed solid, so depth alone is correct here and costs nothing at this
    // triangle count.

    /* ---- tiny matrix helpers -------------------------------------- */
    function mul(a, b) {
      var o = new Float32Array(16), i, j, k, s;
      for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) {
        s = 0; for (k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        o[i * 4 + j] = s;
      }
      return o;
    }
    function persp(fov, asp, n, f) {
      var t = 1 / Math.tan(fov / 2);
      return new Float32Array([t / asp,0,0,0, 0,t,0,0, 0,0,(f + n) / (n - f),-1, 0,0,2 * f * n / (n - f),0]);
    }
    function rotY(a){var c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);}
    function rotX(a){var c=Math.cos(a),s=Math.sin(a);return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);}
    function trans(x,y,z){return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);}

    /* ---- the camera move ---------------------------------------------
     * The object is not a widget that spins in a box. The page scroll IS the
     * camera track: each section gets a keyframe and the camera eases between
     * them, so the recorder is examined from a different side as the argument
     * moves on. Drag adds an offset on top and decays back to the track, so
     * grabbing it never fights the scroll or strands it facing backwards.
     *
     * `ox` shifts the object sideways in view space, which is what lets it swap
     * sides of the page between sections without moving any DOM. */
    /* IT IS A CAMERA, SO IT SHOULD AIM. Spinning it on a scroll percentage was
     * arbitrary — and it desynced from the page, because a fraction of total
     * scroll height has nothing to do with where a section actually is. The lens
     * now points at the focal element nearest the middle of the viewport, so it
     * is looking at whatever you are reading, and the motion is anchored to the
     * content instead of to a number.
     *
     * Only the framing stays on a track: how far away it sits and which side of
     * the page it occupies. */
    /* THE SECTIONS DECIDE WHERE IT SITS, not a scroll percentage. Driving the
     * framing off a fraction of total scroll height is why it drifted out of
     * step with the page and ended up parked on top of the FAQ: that fraction
     * has no relationship to where a section actually is, and it shifts with
     * window height and with any content edit.
     *
     * Each section carries `data-stage="ox,oy,dist,dim"`. Full-width sections
     * push it far out and dim it, because there is no free side of the page for
     * it to occupy — a hero object competing with body copy loses, and should. */
    var STAGE = [].slice.call(document.querySelectorAll("[data-stage]")).map(function (el) {
      var v = el.getAttribute("data-stage").split(",").map(Number);
      return { el: el, ox: v[0], oy: v[1], dist: v[2], dim: v[3] || 0 };
    });
    var FOCUS = [].slice.call(document.querySelectorAll("[data-focus]"));
    /** The lens runs down the model's long axis. Established by measuring the
     *  mesh rather than guessing: the barrel is the Z extent. */
    var LENS = [0, 0, 1];
    /** How far in front of itself the target sits. Larger reads as a gentler
     *  turn; at zero the camera would swing a full 90 degrees to look at
     *  anything beside it. */
    var AIM_Z = 1.35;
    var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
    function frameAt() {
      if (!STAGE.length) return { dist: 5, ox: 0, oy: 0, dim: 0 };
      var mid = innerHeight / 2, i;
      // Centres in document space, so the blend follows the sections themselves.
      var c = STAGE.map(function (s) {
        var r = s.el.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      if (c[0] >= mid) return STAGE[0];
      for (i = 0; i < STAGE.length - 1; i++) {
        if (c[i] <= mid && c[i + 1] >= mid) {
          var span = c[i + 1] - c[i] || 1;
          var t = ease(Math.max(0, Math.min(1, (mid - c[i]) / span)));
          var a = STAGE[i], b = STAGE[i + 1];
          return {
            dist: a.dist + (b.dist - a.dist) * t,
            ox: a.ox + (b.ox - a.ox) * t,
            oy: a.oy + (b.oy - a.oy) * t,
            dim: a.dim + (b.dim - a.dim) * t,
          };
        }
      }
      return STAGE[STAGE.length - 1];
    }

    /** Where the lens should point, in the object's own space. */
    function aimAt(f) {
      var mid = innerHeight / 2, best = null, bestD = Infinity;
      for (var i = 0; i < FOCUS.length; i++) {
        var r = FOCUS[i].getBoundingClientRect();
        if (r.height === 0) continue;
        var d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) { bestD = d; best = r; }
      }
      if (!best) return { yaw: 0.5, pitch: -0.2 };
      // Screen point -> the world plane the object sits in. The eye is at
      // (-ox, -oy, dist) looking down -Z, and the object is at the origin.
      var halfH = Math.tan(0.36) * f.dist;
      var halfW = halfH * (innerWidth / innerHeight);
      var nx = ((best.left + best.width / 2) / innerWidth) * 2 - 1;
      var ny = 1 - ((best.top + best.height / 2) / innerHeight) * 2;
      var tx = -f.ox + nx * halfW, ty = -f.oy + ny * halfH;
      var len = Math.hypot(tx, ty, AIM_Z) || 1;
      var dx = tx / len, dy = ty / len, dz = AIM_Z / len;
      return { yaw: Math.atan2(dx, dz), pitch: -Math.asin(Math.max(-1, Math.min(1, dy))) };
    }

    var f0 = STAGE[0] || { dist: 5, ox: 0, oy: 0, dim: 0 };
    var cur = { dist: f0.dist, ox: f0.ox, oy: f0.oy, dim: f0.dim, yaw: 0.5, pitch: -0.2 };
    var dragYaw = 0, dragPitch = 0;
    var dragging = false, lx = 0, ly = 0;
    function down(e) { dragging = true; cv.classList.add("grabbing"); lx = (e.touches ? e.touches[0] : e).clientX; ly = (e.touches ? e.touches[0] : e).clientY; }
    function move(e) {
      if (!dragging) return;
      var p = e.touches ? e.touches[0] : e;
      dragYaw += (p.clientX - lx) * 0.009;
      dragPitch += (p.clientY - ly) * 0.006;
      dragPitch = Math.max(-0.7, Math.min(0.7, dragPitch));
      lx = p.clientX; ly = p.clientY;
      if (e.touches) e.preventDefault();
      if (!MOTION) draw(0);
    }
    function up() { dragging = false; cv.classList.remove("grabbing"); }
    cv.style.pointerEvents = "auto";
    cv.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    cv.addEventListener("touchstart", down, { passive: true });
    cv.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);

    function draw(t) {
      fit(cv);
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      var wf = frameAt();
      var wa = aimAt(wf);
      var want = { dist: wf.dist, ox: wf.ox, oy: wf.oy, dim: wf.dim, yaw: wa.yaw, pitch: wa.pitch };
      // Ease toward the track rather than snapping, so a fast scroll reads as a
      // camera catching up instead of a jump cut. Drag decays back into it.
      var k = MOTION ? 0.075 : 1;
      cur.yaw += (want.yaw - cur.yaw) * k;
      cur.pitch += (want.pitch - cur.pitch) * k;
      cur.dist += (want.dist - cur.dist) * k;
      cur.ox += (want.ox - cur.ox) * k;
      cur.oy += (want.oy - cur.oy) * k;
      cur.dim += (want.dim - cur.dim) * k;
      if (!dragging) { dragYaw *= 0.965; dragPitch *= 0.965; }

      var yaw = cur.yaw + dragYaw;
      var pitch = Math.max(-0.9, Math.min(0.9, cur.pitch + dragPitch));
      var m = mul(rotX(pitch), rotY(yaw));
      var view = trans(cur.ox, cur.oy, -cur.dist);
      var proj = persp(0.72, cv.width / cv.height, 0.1, 40);
      gl.uniformMatrix4fv(uM, false, m);
      gl.uniformMatrix4fv(uMVP, false, mul(proj, mul(view, m)));
      gl.uniform3f(uCam, -cur.ox, -cur.oy, cur.dist);
      /* A powered lamp is never perfectly steady, and anything larger than a few
         percent becomes a distraction rather than a detail. */
      gl.uniform1f(uFlick, 0.97 + 0.03 * Math.sin(t * 0.011) * Math.sin(t * 0.037));
      gl.uniform1f(uLamps, HAS_LAMPS);
      gl.uniform1f(uTex, HAS_TEX);
      gl.uniform1f(uDim, cur.dim);
      gl.drawArrays(gl.TRIANGLES, 0, COUNT);
    }

    if (!MOTION) { draw(0); window.addEventListener("resize", function(){ draw(0); }); return; }
    var visible = true;   // the stage is fixed, so it is on screen throughout
    function scrollProgress() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      return h > 0 ? Math.max(0, Math.min(1, window.scrollY / h)) : 0;
    }
    (function loop(t) {
      if (visible) draw(t);
      requestAnimationFrame(loop);
    })(0);
  })();

  /* ═══════════════════════════════════════════════════════════════════
     THE TAPE — frame ticks, a fault flag, a scrub head
     ═══════════════════════════════════════════════════════════════════ */
  (function tape() {
    var cv = document.getElementById("tape");
    if (!cv) return;
    var c = cv.getContext("2d");
    var head = 0;

    function draw() {
      fit(cv);
      var w = cv.width, h = cv.height, dpr = w / cv.getBoundingClientRect().width;
      c.clearRect(0, 0, w, h);
      var pad = 14 * dpr, y0 = 18 * dpr, y1 = h - 26 * dpr;

      // frame ticks
      c.strokeStyle = "#263038"; c.lineWidth = Math.max(1, dpr);
      for (var i = 0; i <= 48; i++) {
        var x = pad + ((w - pad * 2) * i) / 48;
        var tall = i % 4 === 0;
        c.beginPath();
        c.moveTo(x, tall ? y0 : y0 + (y1 - y0) * 0.28);
        c.lineTo(x, tall ? y1 : y1 - (y1 - y0) * 0.28);
        c.stroke();
      }
      // baseline
      c.strokeStyle = "#313d46";
      c.beginPath(); c.moveTo(pad, (y0 + y1) / 2); c.lineTo(w - pad, (y0 + y1) / 2); c.stroke();

      // the scrub head, and the amber trail behind it
      var hx = pad + (w - pad * 2) * head;
      var g = c.createLinearGradient(pad, 0, hx, 0);
      g.addColorStop(0, "rgba(255,182,39,0)");
      g.addColorStop(1, "rgba(255,182,39,.30)");
      c.fillStyle = g; c.fillRect(pad, y0, Math.max(0, hx - pad), y1 - y0);
      c.strokeStyle = "#FFB627"; c.lineWidth = Math.max(1.5, dpr * 1.5);
      c.beginPath(); c.moveTo(hx, y0 - 4 * dpr); c.lineTo(hx, y1 + 4 * dpr); c.stroke();

      // the fault flag at the death
      var fx = pad + (w - pad * 2) * 0.965;
      c.strokeStyle = "#FF4438"; c.lineWidth = Math.max(1.5, dpr * 1.5);
      c.beginPath(); c.moveTo(fx, y0 - 8 * dpr); c.lineTo(fx, y1 + 8 * dpr); c.stroke();
      c.fillStyle = "#FF4438";
      c.beginPath();
      c.moveTo(fx, y0 - 8 * dpr); c.lineTo(fx + 20 * dpr, y0 - 2 * dpr); c.lineTo(fx, y0 + 4 * dpr);
      c.closePath(); c.fill();

      // labels
      c.fillStyle = "#8C9099";
      c.font = 600 + " " + Math.round(9 * dpr) + "px 'Saira Condensed',sans-serif";
      c.fillText("00:00", pad, h - 9 * dpr);
      c.fillStyle = "#FF4438";
      c.textAlign = "right"; c.fillText("DEATH  00:12", w - pad, h - 9 * dpr);
      c.textAlign = "left";
    }

    if (!MOTION) { head = 0.965; draw(); window.addEventListener("resize", draw); return; }
    var vis = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { vis = e[0].isIntersecting; }).observe(cv);
    }
    (function loop() {
      if (vis) { head += (0.965 - head) * 0.012; if (head > 0.9645) head = 0; draw(); }
      requestAnimationFrame(loop);
    })();
  })();

  /* ═══════════════════════════════════════════════════════════════════
     ENGAGEMENT GEOMETRY — our own data, drawn top-down.
     Original artwork by construction: no gameplay footage, no screenshots.
     Epic's Fan Content Policy carves out fan work with no commercial
     objective; marketing a paid subscription is a commercial objective, so
     captured Fortnite frames may not appear anywhere on this site.
     ═══════════════════════════════════════════════════════════════════ */
  (function geo() {
    var cv = document.getElementById("geo");
    if (!cv) return;
    var c = cv.getContext("2d");
    var t = 0;

    function draw() {
      fit(cv);
      var w = cv.width, h = cv.height, dpr = w / cv.getBoundingClientRect().width;
      var S = Math.min(w, h);
      c.clearRect(0, 0, w, h);

      // grid
      c.strokeStyle = "rgba(38,48,56,.85)"; c.lineWidth = Math.max(1, dpr * 0.8);
      var step = S / 9;
      for (var i = 1; i < 20; i++) {
        var x = i * step, y = i * step;
        if (x < w) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
        if (y < h) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      }

      var me = { x: w * 0.34, y: h * 0.68 };
      var op = { x: w * 0.70, y: h * 0.30 };

      // storm edge, a slow arc through the corner
      c.strokeStyle = "rgba(255,182,39,.22)";
      c.lineWidth = Math.max(1.5, dpr * 1.6);
      c.beginPath(); c.arc(w * 1.28, h * 1.18, S * 1.02, Math.PI, Math.PI * 1.5); c.stroke();
      c.fillStyle = "#8C9099";
      c.font = 600 + " " + Math.round(9 * dpr) + "px 'Saira Condensed',sans-serif";
      c.fillText("STORM EDGE", w * 0.055, h * 0.115);

      // the opponent's facing cone
      var ang = Math.atan2(me.y - op.y, me.x - op.x);
      var spread = 0.36;
      var reach = S * 0.62;
      var cg = c.createRadialGradient(op.x, op.y, 0, op.x, op.y, reach);
      cg.addColorStop(0, "rgba(255,68,56,.26)");
      cg.addColorStop(1, "rgba(255,68,56,0)");
      c.fillStyle = cg;
      c.beginPath(); c.moveTo(op.x, op.y);
      c.arc(op.x, op.y, reach, ang - spread, ang + spread); c.closePath(); c.fill();

      // range line
      c.strokeStyle = "rgba(231,228,220,.42)";
      c.lineWidth = Math.max(1, dpr);
      c.setLineDash([6 * dpr, 5 * dpr]);
      c.beginPath(); c.moveTo(me.x, me.y); c.lineTo(op.x, op.y); c.stroke();
      c.setLineDash([]);
      var mx = (me.x + op.x) / 2, my = (me.y + op.y) / 2;
      c.fillStyle = "#E7E4DC";
      c.font = Math.round(11 * dpr) + "px 'IBM Plex Mono',monospace";
      c.fillText("34 m", mx + 8 * dpr, my - 6 * dpr);

      // opponent marker — fault red, elevated
      c.fillStyle = "#FF4438";
      c.beginPath(); c.arc(op.x, op.y, 5.5 * dpr, 0, 7); c.fill();
      c.strokeStyle = "rgba(255,68,56,.55)"; c.lineWidth = Math.max(1, dpr);
      var pulse = 1 + (MOTION ? Math.sin(t * 0.05) * 0.16 : 0);
      c.beginPath(); c.arc(op.x, op.y, 13 * dpr * pulse, 0, 7); c.stroke();
      c.fillStyle = "#FF4438";
      c.font = 600 + " " + Math.round(9.5 * dpr) + "px 'Saira Condensed',sans-serif";
      c.fillText("OPPONENT  +11 m", op.x + 17 * dpr, op.y + 3 * dpr);

      // you — amber
      c.fillStyle = "#FFB627";
      c.beginPath(); c.arc(me.x, me.y, 5.5 * dpr, 0, 7); c.fill();
      c.fillStyle = "#FFB627";
      c.fillText("YOU", me.x - 30 * dpr, me.y + 3 * dpr);

      // the peek: two prior looks from the same side, then the fatal third
      c.strokeStyle = "rgba(255,182,39,.5)";
      c.lineWidth = Math.max(1, dpr);
      for (var k = 0; k < 3; k++) {
        var off = (k - 1) * 5 * dpr;
        c.globalAlpha = k === 2 ? 1 : 0.42;
        c.beginPath();
        c.moveTo(me.x + off, me.y + off);
        c.lineTo(me.x + off + Math.cos(ang + Math.PI) * -S * 0.2,
                 me.y + off + Math.sin(ang + Math.PI) * -S * 0.2);
        c.stroke();
      }
      c.globalAlpha = 1;
    }

    if (!MOTION) { draw(); window.addEventListener("resize", draw); return; }
    var vis = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { vis = e[0].isIntersecting; }).observe(cv);
    }
    (function loop() { if (vis) { t++; draw(); } requestAnimationFrame(loop); })();
  })();
  /* ═══════════════════════════════════════════════════════════════════
     KINETIC TYPE
     ═══════════════════════════════════════════════════════════════════ */
  (function kinetic() {
    var h = document.querySelector("h1.kin");
    if (!h) return;
    var words = h.querySelectorAll("span");
    if (!MOTION || !h.animate) {
      for (var i = 0; i < words.length; i++) words[i].style.opacity = 1;
      return;
    }
    // WAAPI rather than a library: the stagger is six lines and it runs on the
    // compositor. Rotate a little on X so the words arrive with some weight
    // instead of sliding.
    for (var j = 0; j < words.length; j++) {
      words[j].animate(
        [{ opacity: 0, transform: "translateY(.5em) rotateX(-40deg)" },
         { opacity: 1, transform: "none" }],
        { duration: 720, delay: 90 + j * 68, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both" });
    }
  })();

  /* ═══════════════════════════════════════════════════════════════════
     CURSOR LIGHT — the amber pool follows the pointer
     ═══════════════════════════════════════════════════════════════════ */
  (function cursor() {
    var el = document.getElementById("cursorlight");
    if (!el || !MOTION || matchMedia("(pointer: coarse)").matches) { if (el) el.remove(); return; }
    var tx = innerWidth / 2, ty = innerHeight / 3, x = tx, y = ty, raf = 0;
    addEventListener("pointermove", function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });
    function step() {
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;
      el.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(step) : 0;
    }
    step();
  })();

  /* ═══════════════════════════════════════════════════════════════════
     DUST — the room. Depth, so nothing floats on flat black.
     Encodes NO data, deliberately: atmosphere driven by a player's own numbers
     would imply a reading nobody asked for and nobody could verify.
     ═══════════════════════════════════════════════════════════════════ */
  (function dust() {
    var cv = document.getElementById("dust");
    if (!cv) return;
    if (!MOTION) { cv.remove(); return; }
    var c = cv.getContext("2d");
    var motes = [], N = Math.min(150, Math.round(innerWidth / 11));
    for (var i = 0; i < N; i++) {
      motes.push({ x: Math.random(), y: Math.random(), z: 0.25 + Math.random() * 0.75,
                   vx: (Math.random() - 0.5) * 0.00016, vy: -0.00006 - Math.random() * 0.00012 });
    }
    var sy = 0;
    addEventListener("scroll", function () { sy = window.scrollY; }, { passive: true });
    (function loop() {
      fit(cv);
      var w = cv.width, h = cv.height, dpr = w / cv.getBoundingClientRect().width;
      c.clearRect(0, 0, w, h);
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        m.x += m.vx; m.y += m.vy;
        if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
        if (m.x < -0.05) m.x = 1.05; else if (m.x > 1.05) m.x = -0.05;
        // Parallax: nearer motes travel further against the scroll.
        var py = (m.y * h + sy * dpr * 0.06 * m.z) % (h + 40) ;
        var r = (0.5 + m.z * 1.6) * dpr;
        c.globalAlpha = 0.05 + m.z * 0.16;
        c.fillStyle = m.z > 0.72 ? "#FFB627" : "#8C9099";
        c.beginPath(); c.arc(m.x * w, py, r, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
      requestAnimationFrame(loop);
    })();
  })();

  /* ═══════════════════════════════════════════════════════════════════
     HORIZONTAL CASE LOG — cards travel sideways as the page scrolls down
     ═══════════════════════════════════════════════════════════════════ */
  (function hlog() {
    var box = document.getElementById("hlog");
    if (!box) return;
    var track = box.querySelector(".htrack");
    if (!track) return;
    if (!MOTION) { box.style.overflowX = "auto"; return; }
    var x = 0, tx = 0;
    function measure() {
      var over = track.scrollWidth - box.clientWidth;
      if (over <= 0) { tx = 0; return; }
      var r = box.getBoundingClientRect();
      // Progress of the section through the viewport, 0 as it enters, 1 as it
      // leaves — so the travel is tied to scroll rather than to a timer.
      var p = 1 - (r.top + r.height) / (innerHeight + r.height);
      tx = -Math.max(0, Math.min(1, p)) * over;
    }
    addEventListener("scroll", measure, { passive: true });
    addEventListener("resize", measure);
    measure();
    (function loop() {
      x += (tx - x) * 0.09;
      track.style.transform = "translate3d(" + x.toFixed(1) + "px,0,0)";
      requestAnimationFrame(loop);
    })();
  })();
})();
