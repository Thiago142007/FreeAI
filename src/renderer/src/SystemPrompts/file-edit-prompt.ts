export interface FileEditPromptInput {
  // O editor pode estar sem arquivo aberto; o chamador já decide se envia ou não.
  path: string | null;
  root: string | null;
  content: string;
  request: string;
  onlyThisFile: boolean;
}

// Prompt do chat que acompanha um arquivo aberto no editor.
export function buildFileEditPrompt({ path, root, content, request, onlyThisFile }: FileEditPromptInput): string {
  const prompt =
    `[FILE EDIT] The user is editing this file locally in the FreeAI editor.\n` +
    `File path: ${path}\nProject root: ${root}\n\n` +
    `[CURRENT FILE CONTENT]:\n\`\`\`\n${content}\n\`\`\`\n\n` +
    `[USER REQUEST]:\n${request}`;

  if (!onlyThisFile) return prompt;

  return prompt +
    `\n\n[STRICT SCOPE] You are ONLY allowed to modify the single file ${path} ` +
    `(use write_to_file / replace_file_content on exactly this path). Do NOT create, modify, ` +
    `delete or move ANY other file or directory in the project. If the correct fix would require ` +
    `touching another file, do not do it — explain what would be needed instead.`;
}
