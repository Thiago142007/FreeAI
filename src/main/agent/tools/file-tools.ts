import * as fs from 'fs';
import * as path from 'path';

export interface FileViewResult {
  content: string;
  totalLines: number;
  startLine: number;
  endLine: number;
}

export function viewFile(
  filePath: string,
  startLine: number = 1,
  endLine?: number
): FileViewResult {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File does not exist: ${resolvedPath}`);
  }

  const rawContent = fs.readFileSync(resolvedPath, 'utf-8');
  const lines = rawContent.split('\n');
  const totalLines = lines.length;

  const actualStart = Math.max(1, startLine);
  const actualEnd = endLine ? Math.min(totalLines, endLine) : Math.min(totalLines, actualStart + 400);

  const selectedLines = lines.slice(actualStart - 1, actualEnd);
  const formatted = selectedLines
    .map((line, idx) => `${actualStart + idx}: ${line}`)
    .join('\n');

  return {
    content: formatted,
    totalLines,
    startLine: actualStart,
    endLine: actualEnd,
  };
}

export function writeToFile(
  filePath: string,
  content: string,
  overwrite: boolean = true
): { success: boolean; path: string; bytesWritten: number } {
  const resolvedPath = path.resolve(filePath);
  const dir = path.dirname(resolvedPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(resolvedPath) && !overwrite) {
    throw new Error(`File already exists and overwrite is set to false: ${resolvedPath}`);
  }

  fs.writeFileSync(resolvedPath, content, 'utf-8');
  return {
    success: true,
    path: resolvedPath,
    bytesWritten: Buffer.byteLength(content, 'utf-8'),
  };
}

export function replaceFileContent(
  filePath: string,
  targetContent: string,
  replacementContent: string
): { success: boolean; replacementsCount: number } {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File does not exist: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  if (!content.includes(targetContent)) {
    throw new Error(`Target content not found in file: ${resolvedPath}`);
  }

  const updatedContent = content.replace(targetContent, replacementContent);
  fs.writeFileSync(resolvedPath, updatedContent, 'utf-8');

  return {
    success: true,
    replacementsCount: 1,
  };
}

export function listDirectory(dirPath: string): string[] {
  const resolvedPath = path.resolve(dirPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Directory does not exist: ${resolvedPath}`);
  }

  const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
  return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
}

export function searchFiles(
  dirPath: string,
  query: string,
  maxResults: number = 50
): { file: string; line: number; match: string }[] {
  const resolvedPath = path.resolve(dirPath);
  const results: { file: string; line: number; match: string }[] = [];

  function traverse(current: string) {
    if (results.length >= maxResults) return;
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
        continue;
      }

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile()) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(query)) {
              results.push({
                file: path.relative(resolvedPath, fullPath),
                line: i + 1,
                match: lines[i].trim(),
              });
              if (results.length >= maxResults) break;
            }
          }
        } catch {
          // ignore binary files
        }
      }
    }
  }

  traverse(resolvedPath);
  return results;
}
