import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { writeToFile, replaceFileContent } from './file-tools';
import {
  renderToTriangles,
  renderPreviewPng,
  meshStats,
  exportMesh,
  Triangle,
  ExportFormat
} from './scad-engine';

const FORMATS: ExportFormat[] = ['stl', 'binstl', 'amf', 'off', '3mf'];
const EXT: Record<ExportFormat, string> = {
  stl: 'stl',
  binstl: 'stl',
  amf: 'amf',
  off: 'off',
  '3mf': '3mf'
};

// Renderizar custa uma instância WASM nova por chamada; guardar a malha evita
// recomeçar o motor a cada preview/export da mesma versão do arquivo.
const meshCache = new Map<string, { hash: string; tris: Triangle[] }>();

function resolveModelFile(modelPath: string, cwd: string): string {
  const p = path.isAbsolute(modelPath) ? modelPath : path.resolve(cwd, modelPath);
  if (!fs.existsSync(p)) {
    throw new Error(`arquivo .scad não encontrado: ${p} (crie com create_3d_model antes)`);
  }
  return p;
}

async function getMesh(file: string): Promise<{ tris: Triangle[]; stats: ReturnType<typeof meshStats> }> {
  const code = fs.readFileSync(file, 'utf-8');
  const hash = crypto.createHash('sha1').update(code).digest('hex');
  const cached = meshCache.get(file);
  const tris = cached && cached.hash === hash ? cached.tris : await renderToTriangles(code);
  meshCache.set(file, { hash, tris });
  return { tris, stats: meshStats(tris) };
}

function formatStats(stats: ReturnType<typeof meshStats>): string {
  return (
    `triângulos: ${stats.triangles} | dimensões (X×Y×Z mm): ${stats.bbox.size.join(' × ')} | ` +
    `volume: ${stats.volumeMm3} mm³`
  );
}

export function create3dModel(
  cwd: string,
  name: string,
  code: string,
  overwrite = false
): { path: string; bytesWritten: number } {
  const clean = String(name || '').trim().replace(/\.scad$/i, '').replace(/[^\w.-]+/g, '_');
  if (!clean) throw new Error('informe um nome para o modelo');
  if (!code || !code.trim()) throw new Error('o código .scad está vazio');
  const target = path.resolve(cwd, 'models', `${clean}.scad`);
  if (fs.existsSync(target) && !overwrite) {
    throw new Error(`já existe ${target} — use overwrite=true ou edit_3d_model`);
  }
  return writeToFile(target, code.trimEnd() + '\n', true);
}

export async function render3dModel(cwd: string, modelPath: string): Promise<string> {
  const file = resolveModelFile(modelPath, cwd);
  const { stats } = await getMesh(file);
  return `Modelo renderizado: ${file}\n${formatStats(stats)}`;
}

export async function preview3dModel(cwd: string, modelPath: string): Promise<string> {
  const file = resolveModelFile(modelPath, cwd);
  const { tris, stats } = await getMesh(file);
  const png = renderPreviewPng(tris);
  const out = `${file.replace(/\.scad$/i, '')}.png`;
  fs.writeFileSync(out, png);
  return (
    `Pré-visualização salva em ${out} (3 vistas: isométrica, superior, frontal)\n` +
    `${formatStats(stats)}\nO usuário vê essa imagem no painel de artefatos.`
  );
}

export function edit3dModel(
  cwd: string,
  modelPath: string,
  targetContent: string,
  replacementContent: string
): string {
  const file = resolveModelFile(modelPath, cwd);
  if (!targetContent || replacementContent === undefined) {
    throw new Error('edit_3d_model exige targetContent (trecho exato) e replacementContent');
  }
  const res = replaceFileContent(file, targetContent, replacementContent);
  return `Modelo atualizado em ${file} (${res.replacementsCount} substituição(ões)). ` +
    `Rode render_3d_model e preview_3d_model para conferir.`;
}

export async function export3dModel(
  cwd: string,
  modelPath: string,
  format: string
): Promise<string> {
  const fmt = String(format || 'stl').toLowerCase() as ExportFormat;
  if (!FORMATS.includes(fmt)) {
    throw new Error(`formato inválido "${format}". Use: ${FORMATS.join(', ')}`);
  }
  const file = resolveModelFile(modelPath, cwd);
  const { tris, stats } = await getMesh(file);
  const name = path.basename(file).replace(/\.scad$/i, '');
  const out = `${file.replace(/\.scad$/i, '')}.${EXT[fmt]}`;
  const bytes = exportMesh(tris, fmt, name);
  fs.writeFileSync(out, bytes);
  return `Exportado ${out} (${fmt}, ${bytes.length} bytes)\n${formatStats(stats)}`;
}
