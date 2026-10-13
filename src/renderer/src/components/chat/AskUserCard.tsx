import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, MessageSquareText, Send } from 'lucide-react';
import { AskUserAnswer, AskUserQuestion } from '../../types';
import { useAskStore } from '../../store/ask-store';
import { useChatStore } from '../../store/chat-store';

const FREE_TEXT_LABEL = 'Fale sua opinião';

export const AskUserCard: React.FC<{ requestId: string }> = ({ requestId }) => {
  const ask = useAskStore((s) => s.pending[requestId]);
  const submitted = useAskStore((s) => s.submitted[requestId]);
  const markSubmitted = useAskStore((s) => s.markSubmitted);
  const addMessage = useChatStore((s) => s.addMessage);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [freeTextFor, setFreeTextFor] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');

  const questions: AskUserQuestion[] = ask?.questions || [];
  const isReview = step >= questions.length;
  const current = questions[step];
  const answered = questions.filter((q) => answers[q.id]).length;

  const record = (question: AskUserQuestion, answer: string) => {
    setAnswers((prev) => ({ ...prev, [question.id]: answer }));
    setFreeTextFor(null);
    setFreeText('');
    setStep((s) => s + 1);
  };

  const confirm = () => {
    const payload: AskUserAnswer[] = questions.map((q) => ({
      question: q.question,
      answer: answers[q.id] || '(sem resposta)'
    }));

    if (ask?.conversationId) {
      const text =
        'Minhas respostas:\n' + payload.map((a) => `• ${a.question}\n  → ${a.answer}`).join('\n');
      addMessage(ask.conversationId, { role: 'user', content: text });
    }

    window.freeai?.answerAskUser(requestId, payload);
    markSubmitted(requestId, payload);
  };

  if (submitted) {
    return (
      <div className="my-2 rounded-lg border border-ag-border bg-ag-bg-card p-3 text-xs">
        <div className="flex items-center gap-2 text-ag-green font-semibold mb-1.5">
          <Check className="w-3.5 h-3.5" />
          Respostas enviadas
        </div>
        <div className="space-y-1 text-ag-text-secondary">
          {submitted.map((a, i) => (
            <div key={i}>
              <span className="text-ag-text-muted">{a.question}</span>
              <span className="mx-1.5">→</span>
              <span className="text-ag-text">{a.answer}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!ask) return null;

  return (
    <div className="my-2 rounded-lg border border-ag-border-focus/30 bg-ag-bg-card overflow-hidden text-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-ag-bg-secondary border-b border-ag-border">
        <div className="flex items-center gap-2 font-semibold text-ag-text">
          <MessageSquareText className="w-3.5 h-3.5 text-ag-accent" />
          {isReview ? 'Revise suas respostas' : `Pergunta ${step + 1} de ${questions.length}`}
        </div>
        {step > 0 && !isReview && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-ag-text-muted hover:text-ag-text hover:bg-ag-bg-hover transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Voltar
          </button>
        )}
      </div>

      {!isReview && current && (
        <div className="p-3 space-y-2">
          <div className="text-ag-text font-medium leading-snug">{current.question}</div>

          <div className="space-y-1.5">
            {current.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => record(current, opt)}
                className={`w-full text-left px-3 py-2 rounded-md border transition-all ${
                  answers[current.id] === opt
                    ? 'bg-ag-accent text-ag-bg border-ag-accent'
                    : 'bg-ag-bg border-ag-border text-ag-text hover:border-ag-border-light hover:bg-ag-bg-hover'
                }`}
              >
                {opt}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setFreeTextFor(freeTextFor === current.id ? null : current.id)}
              className={`w-full text-left px-3 py-2 rounded-md border border-dashed transition-all ${
                freeTextFor === current.id
                  ? 'border-ag-border-light text-ag-text'
                  : 'border-ag-border text-ag-text-muted hover:text-ag-text hover:bg-ag-bg-hover'
              }`}
            >
              {FREE_TEXT_LABEL}
            </button>

            {freeTextFor === current.id && (
              <div className="space-y-1.5 pt-1">
                <textarea
                  autoFocus
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Escreva sua resposta..."
                  className="w-full px-3 py-2 rounded-md bg-ag-bg border border-ag-border text-ag-text resize-none h-16 focus:outline-none focus:border-ag-border-focus"
                />
                <button
                  type="button"
                  disabled={!freeText.trim()}
                  onClick={() => record(current, freeText.trim())}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ag-accent text-ag-bg font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ag-accent-hover transition-all"
                >
                  Responder
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isReview && (
        <div className="p-3 space-y-2">
          <div className="space-y-1.5">
            {questions.map((q, i) => (
              <div
                key={q.id}
                className="flex items-start justify-between gap-3 px-3 py-2 rounded-md bg-ag-bg border border-ag-border"
              >
                <div className="min-w-0">
                  <div className="text-ag-text-muted">{q.question}</div>
                  <div className="text-ag-text font-medium break-words">{answers[q.id] || '—'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className="shrink-0 px-2 py-0.5 rounded border border-ag-border text-ag-text-secondary hover:text-ag-text hover:border-ag-border-light transition-colors"
                >
                  Trocar
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={answered < questions.length}
            onClick={confirm}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-ag-accent text-ag-bg font-medium hover:bg-ag-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            Confirmar e enviar
          </button>
        </div>
      )}
    </div>
  );
};
