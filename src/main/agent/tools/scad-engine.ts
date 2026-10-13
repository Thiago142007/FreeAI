import zlib from 'node:zlib';
import { zipSync, strToU8 } from 'fflate';

export type Vec3 = [number, number, number];
export type Triangle = [Vec3, Vec3, Vec3];

export interface MeshStats {
  triangles: number;
  bbox: { min: Vec3; max: Vec3; size: Vec3 };
  volumeMm3: number;
}

export type ExportFormat = 'stl' | 'binstl' | 'amf' | 'off' | '3mf';

// O motor é ESM-only e o main compila para CommonJS: import() contorna a transpilação.
const dynamicImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>;
let factoryPromise: Promise<any> | null = null;

function loadFactory(): Promise<any> {
  if (!factoryPromise) {
    factoryPromise = dynamicImport('openscad-wasm-prebuilt').then((m) => m.createOpenSCAD);
  }
  return factoryPromise;
}

// O módulo encerra o runtime depois de cada callMain: é preciso uma instância nova por render.
async function runOpenscad(code: string, outFile: string, extraArgs: string[]): Promise<Buffer> {
  const createOpenSCAD = await loadFactory();
  const log: string[] = [];
  const collect = (prefix: string) => (msg?: any) => {
    const line = String(msg ?? '').trim();
    if (line && log.length < 40) log.push(`${prefix}${line}`);
  };
  const scad = await createOpenSCAD({ print: collect(''), printErr: collect('ERRO: ') });
  const inst = scad.getInstance();
  inst.FS.writeFile('/model.scad', code);
  const rc = inst.callMain(['/model.scad', '-o', `/${outFile}`, ...extraArgs]);
  const found = inst.FS.analyzePath(`/${outFile}`);
  if (!found.exists || found.size === 0) {
    // Sem o stderr o agente fica às cegas: é a mensagem do OpenSCAD que diz o que corrigir.
    const detail = log.filter((l) => /error|ERROR|syntax|parser|WARNING|undefined module/i.test(l)).slice(0, 6);
    throw new Error(
      `o motor OpenSCAD não produziu geometria (código ${rc}). ` +
      (detail.length ? `Mensagens do motor:\n${detail.join('\n')}` : 'Nenhuma mensagem do motor; revise a sintaxe do .scad.')
    );
  }
  return Buffer.from(inst.FS.readFile(`/${outFile}`));
}

export async function renderToTriangles(code: string): Promise<Triangle[]> {
  const stl = await runOpenscad(code, 'model.stl', ['--export-format=binstl']);
  return parseBinaryStl(stl);
}

export function parseBinaryStl(buf: Buffer): Triangle[] {
  const count = buf.readUInt32LE(80);
  const tris: Triangle[] = [];
  for (let i = 0; i < count; i++) {
    const o = 84 + i * 50;
    if (o + 50 > buf.length) break;
    const v: Vec3[] = [];
    for (let k = 0; k < 3; k++) {
      const b = o + 12 + k * 12;
      v.push([buf.readFloatLE(b), buf.readFloatLE(b + 4), buf.readFloatLE(b + 8)]);
    }
    tris.push([v[0], v[1], v[2]]);
  }
  return tris;
}

function unitNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const u: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n: Vec3 = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0]
  ];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}

export function meshStats(tris: Triangle[]): MeshStats {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  let volume = 0;
  for (const [a, b, c] of tris) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], a[i], b[i], c[i]);
      max[i] = Math.max(max[i], a[i], b[i], c[i]);
    }
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  const round = (n: number) => (Number.isFinite(n) ? +n.toFixed(3) : 0);
  return {
    triangles: tris.length,
    bbox: {
      min: min.map(round) as Vec3,
      max: max.map(round) as Vec3,
      size: max.map((m, i) => round(m - min[i])) as Vec3
    },
    volumeMm3: +Math.abs(volume).toFixed(2)
  };
}

function dedupeVertices(tris: Triangle[]): { verts: Vec3[]; index: number[][] } {
  const map = new Map<string, number>();
  const verts: Vec3[] = [];
  const index: number[][] = [];
  for (const t of tris) {
    const row: number[] = [];
    for (const p of t) {
      const key = `${p[0]},${p[1]},${p[2]}`;
      let id = map.get(key);
      if (id === undefined) {
        id = verts.length;
        map.set(key, id);
        verts.push(p);
      }
      row.push(id);
    }
    index.push(row);
  }
  return { verts, index };
}

export function toStlAscii(tris: Triangle[]): Buffer {
  const out: string[] = ['solid model'];
  for (const [a, b, c] of tris) {
    const n = unitNormal(a, b, c);
    out.push(`facet normal ${n[0]} ${n[1]} ${n[2]}`, '  outer loop');
    for (const p of [a, b, c]) out.push(`    vertex ${p[0]} ${p[1]} ${p[2]}`);
    out.push('  endloop', 'endfacet');
  }
  out.push('endsolid model');
  return Buffer.from(out.join('\n'), 'utf8');
}

export function toStlBinary(tris: Triangle[]): Buffer {
  const buf = Buffer.alloc(84 + tris.length * 50);
  buf.writeUInt32LE(tris.length, 80);
  let o = 84;
  for (const [a, b, c] of tris) {
    const n = unitNormal(a, b, c);
    buf.writeFloatLE(n[0], o);
    buf.writeFloatLE(n[1], o + 4);
    buf.writeFloatLE(n[2], o + 8);
    let v = o + 12;
    for (const p of [a, b, c]) {
      buf.writeFloatLE(p[0], v);
      buf.writeFloatLE(p[1], v + 4);
      buf.writeFloatLE(p[2], v + 8);
      v += 12;
    }
    buf.writeUInt16LE(0, o + 48);
    o += 50;
  }
  return buf;
}

export function toOff(tris: Triangle[]): Buffer {
  const { verts, index } = dedupeVertices(tris);
  const lines = [`OFF ${verts.length} ${index.length} 0`];
  for (const p of verts) lines.push(`${p[0]} ${p[1]} ${p[2]}`);
  for (const r of index) lines.push(`3 ${r[0]} ${r[1]} ${r[2]}`);
  return Buffer.from(lines.join('\n') + '\n', 'utf8');
}

function vertexXml(verts: Vec3[], pad: string, selfClose: boolean): string {
  return verts
    .map((p) =>
      selfClose
        ? `${pad}<vertex x="${p[0]}" y="${p[1]}" z="${p[2]}" />`
        : `${pad}<vertex><coordinates><x>${p[0]}</x><y>${p[1]}</y><z>${p[2]}</z></coordinates></vertex>`
    )
    .join('\n');
}

export function toAmf(tris: Triangle[]): Buffer {
  const { verts, index } = dedupeVertices(tris);
  const triangles = index
    .map((r) => r.map((i) => `        <vertex><coordinates><x>${verts[i][0]}</x><y>${verts[i][1]}</y><z>${verts[i][2]}</z></coordinates></vertex>`).join('\n'))
    .map((b) => `      <triangle>\n${b}\n      </triangle>`)
    .join('\n');
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<amf unit="millimeter">\n  <object id="0">\n    <mesh>\n      <vertices>\n${vertexXml(
      verts,
      '        ',
      false
    )}\n      </vertices>\n      <volume>\n${triangles}\n      </volume>\n    </mesh>\n  </object>\n</amf>\n`;
  return Buffer.from(xml, 'utf8');
}

// O build WASM em uso não inclui lib3mf, então o contêiner 3MF (ZIP + XML) é montado
// a partir da malha já triangulada.
export function to3mf(tris: Triangle[], title: string): Buffer {
  const { verts, index } = dedupeVertices(tris);
  const model =
    `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n` +
    `  <resources>\n    <object id="1" type="model">\n      <mesh>\n        <vertices>\n` +
    vertexXml(verts, '          ', true) +
    `\n        </vertices>\n        <triangles>\n` +
    index.map((r) => `          <triangle v1="${r[0]}" v2="${r[1]}" v3="${r[2]}" />`).join('\n') +
    `\n        </triangles>\n      </mesh>\n    </object>\n  </resources>\n  <build>\n    <item objectid="1" />\n  </build>\n</model>\n`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
    `  <Relationship Target="/3D/3dmodel.model" Id="rel-3dmodel-0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />\n</Relationships>\n`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n` +
    `  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />\n` +
    `  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />\n</Types>\n`;

  const meta =
    `<?xml version="1.0" encoding="UTF-8"?>\n<coreProperties xmlns="http://schemas.openxmlformats.org/package/2005/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">\n` +
    `  <dc:title>${title.replace(/[<>&]/g, '')}</dc:title>\n  <dc:creator>FreeAI</dc:creator>\n</coreProperties>\n`;

  const zipped = zipSync(
    {
      '[Content_Types].xml': strToU8(contentTypes),
      '_rels/.rels': strToU8(rels),
      'docProps/core.xml': strToU8(meta),
      '3D/3dmodel.model': strToU8(model)
    },
    { level: 6 }
  );
  return Buffer.from(zipped);
}

export function exportMesh(tris: Triangle[], format: ExportFormat, title: string): Buffer {
  switch (format) {
    case 'stl':
      return toStlAscii(tris);
    case 'binstl':
      return toStlBinary(tris);
    case 'amf':
      return toAmf(tris);
    case 'off':
      return toOff(tris);
    case '3mf':
      return to3mf(tris, title);
    default:
      throw new Error(`formato desconhecido: ${format} (use stl, binstl, amf, off ou 3mf)`);
  }
}

/* ---------- pré-visualização em CPU (sem GPU/WebGL) ---------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function rotate(p: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = p[0] * cy + p[2] * sy;
  const z1 = -p[0] * sy + p[2] * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y2 = p[1] * cp - z1 * sp;
  const z2 = p[1] * sp + z1 * cp;
  return [x1, y2, z2];
}

interface ViewOptions {
  yaw: number;
  pitch: number;
  label: string;
}

const VIEWS: ViewOptions[] = [
  { yaw: Math.PI / 4, pitch: -Math.PI / 7, label: 'isométrica' },
  // pitch 0 projeta (x, y) com profundidade em z: câmera olhando pelo eixo Z.
  { yaw: 0, pitch: 0, label: 'superior' },
  // pitch -90 projeta (x, z): câmera na altura do plano XY.
  { yaw: 0, pitch: -Math.PI / 2, label: 'frontal' }
];

const BG: Vec3 = [27, 27, 27];
const FACE: Vec3 = [216, 216, 216];
const LIGHT: Vec3 = [0.35, -0.55, 0.76];

function drawView(
  tris: Triangle[],
  view: ViewOptions,
  center: Vec3,
  scale: number,
  cell: number,
  ox: number,
  oy: number,
  rgb: Buffer,
  depth: Float32Array,
  w: number,
  h: number
) {
  for (const [a, b, c] of tris) {
    const n = unitNormal(a, b, c);
    const rn = rotate(n, view.yaw, view.pitch);
    const shade = Math.max(0, -(rn[0] * LIGHT[0] + rn[1] * LIGHT[1] + rn[2] * LIGHT[2]));
    const lum = 0.22 + 0.78 * shade;
    const color = FACE.map((v) => Math.round(v * lum));

    const pts = [a, b, c].map((p) => {
      const r = rotate([p[0] - center[0], p[1] - center[1], p[2] - center[2]], view.yaw, view.pitch);
      return { x: ox + cell / 2 + r[0] * scale, y: oy + cell / 2 - r[1] * scale, z: r[2] };
    });

    const minX = Math.max(ox, Math.floor(Math.min(pts[0].x, pts[1].x, pts[2].x)));
    const maxX = Math.min(ox + cell - 1, Math.ceil(Math.max(pts[0].x, pts[1].x, pts[2].x)));
    const minY = Math.max(oy, Math.floor(Math.min(pts[0].y, pts[1].y, pts[2].y)));
    const maxY = Math.min(oy + cell - 1, Math.ceil(Math.max(pts[0].y, pts[1].y, pts[2].y)));

    const d = (pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) - (pts[2].x - pts[0].x) * (pts[1].y - pts[0].y);
    if (Math.abs(d) < 1e-6) continue;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((pts[1].x - px) * (pts[2].y - py) - (pts[2].x - px) * (pts[1].y - py)) / d;
        const w1 = ((pts[2].x - px) * (pts[0].y - py) - (pts[0].x - px) * (pts[2].y - py)) / d;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * pts[0].z + w1 * pts[1].z + w2 * pts[2].z;
        const idx = y * w + x;
        if (z <= depth[idx]) continue;
        depth[idx] = z;
        const o = (y * w + x) * 3;
        rgb[o] = color[0];
        rgb[o + 1] = color[1];
        rgb[o + 2] = color[2];
      }
    }
  }
}

export function renderPreviewPng(tris: Triangle[], width = 900): Buffer {
  const stats = meshStats(tris);
  const { min, max } = stats.bbox;
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const span = Math.max(...max.map((m, i) => m - min[i])) || 1;

  const cell = Math.floor(width / VIEWS.length);
  const h = cell;
  const w = cell * VIEWS.length;
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    rgb[i * 3] = BG[0];
    rgb[i * 3 + 1] = BG[1];
    rgb[i * 3 + 2] = BG[2];
  }
  const depth = new Float32Array(w * h).fill(-Infinity);
  const scale = (cell * 0.78) / span;

  VIEWS.forEach((view, i) => drawView(tris, view, center, scale, cell, i * cell, 0, rgb, depth, w, h));
  return encodePng(w, h, rgb);
}
