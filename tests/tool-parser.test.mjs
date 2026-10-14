import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const nodeRequire = createRequire(import.meta.url);
const dist = (rel) => nodeRequire(path.join(import.meta.dirname, '..', 'dist', 'main', rel));

const { parseToolCalls, looksLikeToolCall } = dist('agent/tool-parser.js');

const OPEN = '<tool_call';
const CLOSE = '<' + '/tool_call>';
const xml = (name, body) => OPEN + ' name="' + name + '">' + body + CLOSE;
const FENCE = '```';
const DSML = '<' + String.fromCharCode(0xff5c) + String.fromCharCode(0xff5c) + 'DSML' + String.fromCharCode(0xff5c) + String.fromCharCode(0xff5c) + '>';
const DSML_END = DSML + 'invoke' + '>';

const formats = [
  { label: 'XML com nome na tag', text: xml('run_command', '{"command":"ls"}'), name: 'run_command', param: 'command', value: 'ls' },
  { label: 'Markdown MCP', text: '###MCP_TOOL###\n' + '{"tool":"list_directory","parameters":{}}\n###END_MCP_TOOL###', name: 'list_directory' },
  { label: 'Bloco JSON com tool', text: FENCE + 'json\n' + '{"tool":"search_web","parameters":{"query":"openscad"}}\n' + FENCE, name: 'search_web', param: 'query', value: 'openscad' },
  { label: 'Bloco JSON com command', text: FENCE + '\n' + '{"command":"view_file","parameters":{"path":"/tmp/a"}}\n' + FENCE, name: 'view_file', param: 'path', value: '/tmp/a' },
  { label: 'DSML com corpo JSON', text: DSML + 'invoke name="run_command">{"command":"pwd"}' + DSML_END, name: 'run_command', param: 'command', value: 'pwd' }
];

test('parseToolCalls reconhece todos os formatos publicados', () => {
  for (const f of formats) {
    const calls = parseToolCalls(f.text);
    assert.equal(calls.length, 1, f.label + ': esperado 1 call, veio ' + calls.length);
    assert.equal(calls[0].name, f.name, f.label + ': nome errado');
    if (f.param) {
      assert.equal(calls[0].parameters[f.param], f.value, f.label + ': parmetro perdido: ' + JSON.stringify(calls[0].parameters));
    }
  }
});

test('parseToolCalls aceita nomes de parametros variantes (params/args)', () => {
  for (const key of ['parameters', 'params', 'args']) {
    const calls = parseToolCalls(xml('run_command', '{"name":"run_command","' + key + '":{"command":"id"}}'));
    assert.equal(calls.length, 1, key);
    assert.equal(calls[0].parameters.command, 'id', key);
  }
});

test('parseToolCalls preserva parametros objetuais/aninhados', () => {
  const calls = parseToolCalls(xml('simulate_input', '{"actions":[{"action":"click","x":10,"y":20}]}'));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].parameters.actions, [{ action: 'click', x: 10, y: 20 }]);
});

test('parseToolCalls extrai todos os <parameter> DSML (sem perder o 2o)', () => {
  const body =
    DSML + 'parameter name="path" string="true">/tmp/a.txt' + DSML + 'parameter>' +
    DSML + 'parameter name="startLine" string="false">5' + DSML + 'parameter>';
  const calls = parseToolCalls(DSML + 'invoke name="view_file">' + body + DSML_END);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].parameters, { path: '/tmp/a.txt', startLine: 5 },
    'parameters vindos: ' + JSON.stringify(calls[0].parameters));
});

test('parseToolCalls lê multiplas chamadas na mesma mensagem', () => {
  const text = xml('list_directory', '{}') + '\n\n' + xml('view_file', '{"path":"/tmp/b"}');
  const calls = parseToolCalls(text);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((c) => c.name), ['list_directory', 'view_file']);
});

test('parseToolCalls: nome da ferramenta no corpo JSON (variante que o proprio parser prevê)', () => {
  const calls = parseToolCalls(OPEN + '>\n' + '{"name":"run_command","parameters":{"command":"ls"}}\n' + CLOSE);
  assert.equal(calls.length, 1,
    'bloco  náo reconhecido: fica invisível também para looksLikeToolCall=' +
    looksLikeToolCall(OPEN + '>\n' + '{"name":"run_command"}\n' + CLOSE));
});

test('parseToolCalls: bloco truncado (sem tag de fechamento) deve ser recuperado', () => {
  const truncated = OPEN + ' name="run_command">{"command":"ls"}';
  assert.equal(parseToolCalls(truncated).length, 1,
    'chamada truncada é descartada em silêncio: ' + parseToolCalls(truncated).length + ' calls, ' +
    'looksLikeToolCall=' + looksLikeToolCall(truncated));
});

test('looksLikeToolCall detecta marcadores unknown-format', () => {
  const positives = [
    'blá <tool_call name="x"',
    'invoke name="some_tool"',
    '###MCP_TOOL###{}',
    '<function_name="x">',
    FENCE + 'json\n{"tool":"run_command"}\n' + FENCE
  ];
  for (const text of positives) {
    assert.equal(looksLikeToolCall(text), true, 'deveria detectar: ' + text);
  }
  assert.equal(looksLikeToolCall('Resposta normal, sem ferramentas.'), false);
});

test('parseToolCalls: JSON malformado emitido pelo modelo (aspas aninhadas no comando)', () => {
  const content = OPEN + ' name="run_command">\n' +
    `{"command": "echo "HOME=/tmp" "$HOME/Work Area" 2>/dev/null"}\n${CLOSE}`;
  const calls = parseToolCalls(content);
  assert.equal(calls.length, 1,
    'o modelo escreve aspas duplas dentro do comando o tempo todo; JSON.parse falha, ' +
    'a chamada é descartada em silêncio e looksLikeToolCall=' + looksLikeToolCall(content) +
    ' manda o usuário olhar para o protocolo cru');
});
