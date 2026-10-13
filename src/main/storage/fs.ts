import * as fs from 'fs';
import * as path from 'path';

export interface FsEntry {
  name: string;
  path: string;
  type: 'folder' | 'file';
  size?: number;
}

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

function isInsideRoot(target: string, root: string): boolean {
  const resolvedTarget = path.resolve(target);
  const resolvedRoot = path.resolve(root);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
}

export function listDir(dirPath: string): FsEntry[] {
  const resolved = path.resolve(dirPath);
  const entries = fs.readdirSync(resolved, { withFileTypes: true });
  const result: FsEntry[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(resolved, entry.name);
    let size: number | undefined;
    try {
      if (entry.isFile()) size = fs.statSync(fullPath).size;
    } catch {
      continue;
    }
    result.push({
      name: entry.name,
      path: fullPath,
      type: entry.isDirectory() ? 'folder' : 'file',
      size
    });
  }
  result.sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1
  );
  return result.slice(0, 2000);
}

export function readFileForEditor(
  filePath: string,
  root: string
): { content: string; size: number } {
  const resolved = path.resolve(filePath);
  if (!isInsideRoot(resolved, root)) {
    throw new Error(`Fora da pasta raiz permitida: ${root}`);
  }
  const stat = fs.statSync(resolved);
  if (stat.size > MAX_FILE_BYTES) {
    throw new Error(`Arquivo grande demais para editar (${Math.round(stat.size / 1024)}KB > 2MB)`);
  }
  const buffer = fs.readFileSync(resolved);
  // heurística de binário: byte nulo nos primeiros 4KB
  if (buffer.subarray(0, 4096).includes(0)) {
    throw new Error('Arquivo binário — edição não suportada.');
  }
  return { content: buffer.toString('utf-8'), size: stat.size };
}

export function writeFileFromEditor(filePath: string, content: string, root: string): { bytes: number } {
  const resolved = path.resolve(filePath);
  if (!isInsideRoot(resolved, root)) {
    throw new Error(`Fora da pasta raiz permitida: ${root}`);
  }
  fs.writeFileSync(resolved, content, 'utf-8');
  return { bytes: Buffer.byteLength(content, 'utf-8') };
}
