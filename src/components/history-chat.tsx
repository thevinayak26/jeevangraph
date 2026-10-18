'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, FileText } from 'lucide-react';
import type { HistoryAnswer } from '@/lib/history-chat';
const prompts = [
  'Summarize my history',
  'How has my creatinine changed?',
  'Which medicines were recorded?',
  'What allergies are documented?',
  'Show my family history',
];
export function HistoryChat({ cloudAvailable }: { cloudAvailable: boolean }) {
  const [question, setQuestion] = useState(''),
    [cloud, setCloud] = useState(false),
    [messages, setMessages] = useState<{ question: string; answer: HistoryAnswer }[]>([]),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const request = useRef<AbortController | null>(null),
    busy = useRef(false),
    sequence = useRef(0);
  useEffect(() => {
    const invalidate = () => {
      sequence.current++;
      request.current?.abort();
    };
    const clear = () => {
      if (document.hidden) {
        invalidate();
        setMessages([]);
        setQuestion('');
        setPending(false);
        busy.current = false;
      }
    };
    document.addEventListener('visibilitychange', clear);
    return () => {
      invalidate();
      document.removeEventListener('visibilitychange', clear);
    };
  }, []);
  async function ask(value: string) {
    if (busy.current || !value.trim()) return;
    busy.current = true;
    setPending(true);
    setError('');
    const current = ++sequence.current;
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/history-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: value, cloud }),
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Unavailable');
      const answer = (await response.json()) as HistoryAnswer;
      if (current === sequence.current) {
        setMessages((old) => [...old.slice(-4), { question: value, answer }]);
        setQuestion('');
      }
    } catch {
      if (current === sequence.current) {
        setMessages([]);
        setError(
          'History could not be checked. Previous answers have been cleared. Sign in again or retry.',
        );
      }
    } finally {
      clearTimeout(timer);
      if (current === sequence.current) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  return (
    <section className="history-chat">
      <div className="chat-heading">
        <MessageCircle size={28} />
        <div>
          <h1>Ask my history</h1>
          <p>Your reviewed reports, with the source beside every answer.</p>
        </div>
      </div>
      <p className="chat-mode">
        Local evidence assistant · No key required · Up to 100 current reports
      </p>
      <p>
        Ask about recorded results, medicines, allergies or your timeline. This assistant retrieves
        evidence; it does not diagnose or advise treatment. Family answers quote your report notes
        and do not open relatives’ charts.
      </p>
      <div className="chat-prompts">
        {prompts.map((prompt) => (
          <button
            className="button secondary"
            key={prompt}
            disabled={pending}
            onClick={() => void ask(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
      <div className="chat-conversation" aria-live="polite">
        {!messages.length && !pending && (
          <div className="chat-empty">
            <FileText size={30} />
            <h2>Your history is the starting point</h2>
            <p>
              New account? <Link href="/secure/import">Scan and review a report</Link> first. Each
              answer uses your current reviewed sources.
            </p>
          </div>
        )}
        {messages.map((message, index) => (
          <article className="chat-turn" key={index}>
            <p className="chat-question">{message.question}</p>
            <div className="chat-answer">
              <p className="chat-answer-mode">
                {message.answer.mode === 'gemini_topic_router'
                  ? 'Gemini selected the topic; local evidence supplies the answer'
                  : 'Local source-linked answer'}
              </p>
              <p>{message.answer.intro}</p>
              {message.answer.cards.map((card, n) => (
                <section className="chat-card" key={n}>
                  <p>{card.text}</p>
                  <details>
                    <summary>
                      {card.citations.length} supporting source
                      {card.citations.length === 1 ? '' : 's'}
                    </summary>
                    {card.citations.map((cite, k) => (
                      <div className="chat-citation" key={k}>
                        <a href={`/api/private-source/${cite.versionId}`}>
                          {cite.title} · {cite.date ?? 'Date unknown'}
                          {cite.page ? ` · page ${cite.page}` : ''}
                        </a>
                        <blockquote>{cite.excerpt}</blockquote>
                      </div>
                    ))}
                  </details>
                </section>
              ))}
              <p className="chat-notice">{message.answer.notice}</p>
            </div>
          </article>
        ))}
        {pending && <p role="status">Checking your current reviewed sources…</p>}
      </div>
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <label htmlFor="history-question">Your question</label>
        <textarea
          id="history-question"
          maxLength={800}
          rows={3}
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What changed between my first and latest lab report?"
        />
        {cloudAvailable && (
          <label className="assessment-choice">
            <input type="checkbox" checked={cloud} onChange={(e) => setCloud(e.target.checked)} />
            This is a fictional question. Allow Gemini to receive this question only to select its
            topic. Reports stay on the server.
          </label>
        )}
        <div>
          <button className="button primary" disabled={pending || question.trim().length < 2}>
            <Send size={16} />
            Ask my history
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              sequence.current++;
              request.current?.abort();
              busy.current = false;
              setPending(false);
              setMessages([]);
              setQuestion('');
            }}
          >
            Clear conversation
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
      </form>
      <p className="chat-fine">
        Conversation stays in this tab and clears when the tab is hidden. Previous answers are
        snapshots; asking again checks current records. Already read or copied information cannot be
        retracted.
      </p>
    </section>
  );
}
