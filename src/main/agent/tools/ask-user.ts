export interface AskUserQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface AskUserAnswer {
  question: string;
  answer: string;
}

type Sender = (payload: { requestId: string; provider: string; questions: AskUserQuestion[] }) => void;

const MAX_QUESTIONS = 5;
const MAX_OPTIONS = 3;
const ANSWER_TIMEOUT_MS = 10 * 60 * 1000;

interface Pending {
  provider: string;
  resolve: (answers: AskUserAnswer[]) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

const pending = new Map<string, Pending>();

function toQuestions(raw: any): AskUserQuestion[] {
  const list = Array.isArray(raw?.questions) ? raw.questions : raw?.question ? [raw] : [];
  return list
    .map((item: any, i: number) => {
      const question = String(item?.question ?? '').trim();
      const options = (Array.isArray(item?.options) ? item.options : [])
        .map((o: any) => String(o).trim())
        .filter(Boolean)
        .slice(0, MAX_OPTIONS);
      return { id: String(item?.id ?? `q${i + 1}`), question, options };
    })
    .filter((q: AskUserQuestion) => q.question)
    .slice(0, MAX_QUESTIONS);
}

export function requestAnswers(
  requestId: string,
  provider: string,
  rawParameters: any,
  send: Sender
): Promise<string> {
  const questions = toQuestions(rawParameters);
  if (questions.length === 0) {
    return Promise.resolve('Nenhuma pergunta válida foi enviada ao usuário. Refaça a chamada de ask_user com "questions".');
  }

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      resolve('O usuário não respondeu dentro do tempo limite. Prossiga com o que for mais razoável e explique a suposição.');
    }, ANSWER_TIMEOUT_MS);

    pending.set(requestId, {
      provider,
      resolve: (answers) => resolve(formatAnswers(answers)),
      reject,
      timer,
    });

    send({ requestId, provider, questions });
  });
}

function formatAnswers(answers: AskUserAnswer[]): string {
  return (
    '[RESPOSTAS DO USUÁRIO]\n' +
    answers.map((a) => `P: ${a.question}\nR: ${a.answer}`).join('\n\n') +
    '\n\nContinue a tarefa respeitando exatamente essas escolhas.'
  );
}

export function submitAnswers(requestId: string, answers: AskUserAnswer[]): boolean {
  const entry = pending.get(requestId);
  if (!entry) return false;
  clearTimeout(entry.timer);
  pending.delete(requestId);
  entry.resolve(answers);
  return true;
}

export function cancelByProvider(provider: string) {
  for (const [id, entry] of [...pending]) {
    if (entry.provider !== provider) continue;
    clearTimeout(entry.timer);
    pending.delete(id);
    entry.reject(new Error('O usuário cancelou a execução antes de responder.'));
  }
}
