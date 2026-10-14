// Montagem da primeira mensagem enviada ao provedor: prompt de sistema + pedido do usuário.
export function composeInitialRequest(systemPrompt: string, userPrompt: string): string {
  return `${systemPrompt}\n\n[USER REQUEST]:\n${userPrompt}`;
}
