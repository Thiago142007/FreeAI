import * as fs from 'fs';
import * as path from 'path';

// project_memory: adaptação da "PROJECT MEMORY" do ZeroScript — memória
// durável do projeto em um arquivo no workspace, compartilhada entre sessões
const MEMORY_FILE = 'FREEAI_MEMORY.md';

const SKELETON = `# Project memory

## Overview

## Where things live

## Conventions

## Key systems

## Decisions & gotchas

## User preferences

## Open questions / TODO
`;

function memoryPath(cwd: string): string {
  fs.mkdirSync(cwd, { recursive: true });
  return path.join(cwd, MEMORY_FILE);
}

export function readMemory(cwd: string): string {
  const p = memoryPath(cwd);
  if (!fs.existsSync(p)) {
    return `MEMORY_MISSING: ${p} ainda não existe. Crie com project_memory action="create" usando o esqueleto de seções.`;
  }
  return `${p}\n\n${fs.readFileSync(p, 'utf-8')}`;
}

export function writeMemory(params: {
  cwd: string;
  action: 'create' | 'replace_section' | 'append_section' | 'replace_all';
  section?: string;
  content?: string;
}): string {
  const p = memoryPath(params.cwd);
  const action = params.action;
  const content = params.content || '';

  if (action === 'create') {
    if (fs.existsSync(p)) return `Já existe: ${p} (use replace_section ou append_section)`;
    fs.writeFileSync(p, content.trim() ? content : SKELETON, 'utf-8');
    return `Criado ${p}`;
  }

  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, SKELETON, 'utf-8');
  }

  if (action === 'replace_all') {
    fs.writeFileSync(p, content, 'utf-8');
    return `Memória reescrita em ${p}`;
  }

  if (!params.section) throw new Error(`project_memory ${action}: section é obrigatório`);

  const text = fs.readFileSync(p, 'utf-8');
  const header = `## ${params.section}`;
  const start = text.indexOf(header);
  if (start === -1) {
    fs.writeFileSync(p, `${text.trimEnd()}\n\n${header}\n${content}\n`, 'utf-8');
    return `Seção "${params.section}" criada ao final de ${p}`;
  }

  const nextSection = text.indexOf('\n## ', start + header.length);
  const end = nextSection === -1 ? text.length : nextSection + 1;

  if (action === 'replace_section') {
    const updated = text.slice(0, start) + `${header}\n${content}\n\n` + text.slice(end);
    fs.writeFileSync(p, updated, 'utf-8');
    return `Seção "${params.section}" substituída em ${p}`;
  }

  const existing = text.slice(start, end).trimEnd();
  const updated = text.slice(0, start) + `${existing}\n${content}\n` + text.slice(end);
  fs.writeFileSync(p, updated, 'utf-8');
  return `Conteúdo adicionado à seção "${params.section}" de ${p}`;
}
