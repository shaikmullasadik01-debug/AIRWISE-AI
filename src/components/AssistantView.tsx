import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  Send,
  ShieldAlert,
  Trash2,
  User,
} from 'lucide-react';
import type {
  AirQualityPayload,
  AqiStandard,
  ChatMessageItem,
  FamilyProfileId,
} from '../types/airwise';
import { FAMILY_PROFILE_META } from '../utils/airQualityHelpers';

interface AssistantViewProps {
  telemetry: AirQualityPayload | null;
  standard: AqiStandard;
  profiles: FamilyProfileId[];
  messages: ChatMessageItem[];
  prefillQuestion: string | null;
  onClearPrefill: () => void;
  onAddMessage: (msg: ChatMessageItem) => void;
  onClearHistory: () => void;
}

const SUGGESTED_QUESTIONS = [
  'Is it safe to go outside today?',
  'Should my children play outdoors?',
  'How can I protect my family from PM2.5?',
  'What is the best time for outdoor exercise?',
  'How can I improve ventilation at home?',
  'Which transportation option produces fewer emissions?',
  'What should I do during severe winter smog?',
  'What precautions should schools take today?',
];

export function AssistantView({
  telemetry,
  standard,
  profiles,
  messages,
  prefillQuestion,
  onClearPrefill,
  onAddMessage,
  onClearHistory,
}: AssistantViewProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefillQuestion) {
      setInput(prefillQuestion);
      onClearPrefill();
    }
  }, [prefillQuestion, onClearPrefill]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length, sending]);

  async function submitQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed || sending) return;
    if (!telemetry) {
      setErrorMsg('Wait for location telemetry to load before querying the assistant.');
      return;
    }

    setErrorMsg(null);
    setLastFailedQuestion(null);

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    onAddMessage(userMsg);
    setInput('');
    setSending(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.structured ? m.structured.summary : m.text,
      }));

      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          location: telemetry.location,
          standard,
          profiles,
          history: historyPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      onAddMessage({
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: data.summary,
        structured: data,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach AIRWISE AI service.';
      setErrorMsg(msg);
      setLastFailedQuestion(trimmed);
    } finally {
      setSending(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    submitQuestion(input);
  }

  const activeProfileLabels = profiles
    .map((id) => FAMILY_PROFILE_META.find((m) => m.id === id)?.label ?? id)
    .join(', ');

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left Context & Suggested Questions Column */}
      <aside className="space-y-4 lg:col-span-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            AirWise Conversational Advisor
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Powered by server-side Gemini intelligence grounded in your current location telemetry, weather dispersion, and selected family profiles.
          </p>

          <dl className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Active Location</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {telemetry ? `${telemetry.location.name}, ${telemetry.location.country}` : 'Loading…'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">US AQI / Category</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-100">
                {telemetry ? `${telemetry.usAqi ?? 'N/A'} (${telemetry.category.label})` : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Data Integrity</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {telemetry?.dataStatus === 'unavailable-sample'
                  ? 'Sample Baseline (API Unavailable)'
                  : 'Live Model Telemetry'}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 pt-1">
              <dt className="text-slate-500 dark:text-slate-400">Household Profiles</dt>
              <dd className="font-medium text-teal-700 dark:text-teal-300">
                {activeProfileLabels}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Suggested Questions
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={sending}
                onClick={() => submitQuestion(q)}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:bg-sky-950/40 dark:hover:text-sky-200"
              >
                <span>{q}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      </aside>

      {/* Main Chat Workspace */}
      <section
        aria-label="AI conversation workspace"
        className="flex min-h-[560px] flex-col rounded-xl border border-slate-200 bg-white lg:col-span-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Responses distinguish verified measurements from general advice and never replace medical diagnosis.
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {/* Conversation Feed */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                <Bot className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                Ask Anything About Local Air Quality
              </h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Select a suggested question on the left or ask about outdoor play, winter smog, home ventilation, commuting emissions, or school precautions for{' '}
                {telemetry?.location.name ?? 'your city'}.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                    <Bot className="h-4 w-4" aria-hidden="true" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-xl p-4 text-sm ${
                    msg.role === 'user'
                      ? 'bg-sky-700 text-white dark:bg-sky-600'
                      : 'border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                  }`}
                >
                  {msg.role === 'user' || !msg.structured ? (
                    <p className="leading-relaxed">{msg.text}</p>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <div className="text-[11px] font-medium text-sky-700 dark:text-sky-400">
                          Intent: {msg.structured.intentDetected}
                        </div>
                        <p className="mt-1 leading-relaxed text-slate-900 dark:text-slate-100">
                          {msg.structured.summary}
                        </p>
                      </div>

                      {msg.structured.recommendations.length > 0 && (
                        <div className="space-y-2.5 border-t border-slate-200 pt-3 dark:border-slate-800">
                          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            Practical Steps &amp; Rationale
                          </h3>
                          <ol className="space-y-2.5">
                            {msg.structured.recommendations.map((rec, i) => (
                              <li key={i} className="text-xs leading-relaxed">
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {i + 1}. {rec.title}:{' '}
                                </span>
                                <span className="text-slate-700 dark:text-slate-300">
                                  {rec.action}
                                </span>
                                <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                                  Why it matters: {rec.whyItMatters}
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      <div className="space-y-1.5 border-t border-slate-200 pt-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
                        <div>
                          <strong className="text-slate-800 dark:text-slate-200">
                            Verified telemetry basis:
                          </strong>{' '}
                          {msg.structured.dataBasis.verifiedMeasurementsUsed}
                        </div>
                        <div>
                          <strong className="text-slate-800 dark:text-slate-200">
                            General environmental guidance:
                          </strong>{' '}
                          {msg.structured.dataBasis.generalGuidanceUsed}
                        </div>
                        <div>
                          <strong className="text-slate-800 dark:text-slate-200">
                            Limitations &amp; uncertainty:
                          </strong>{' '}
                          {msg.structured.dataBasis.uncertaintyNote}
                        </div>
                      </div>

                      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                        <span>{msg.structured.cautionNote}</span>
                      </div>

                      {msg.structured.followUpQuestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {msg.structured.followUpQuestions.map((fq) => (
                            <button
                              key={fq}
                              type="button"
                              disabled={sending}
                              onClick={() => submitQuestion(fq)}
                              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-left text-xs text-sky-700 transition-colors hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-slate-800"
                            >
                              {fq}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <User className="h-4 w-4" aria-hidden="true" />
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                <Bot className="h-4 w-4 animate-pulse" aria-hidden="true" />
              </div>
              <span>Analyzing live pollutant data and household context…</span>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 sm:flex-row sm:items-center sm:justify-between dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-100"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
              {lastFailedQuestion && (
                <button
                  type="button"
                  onClick={() => submitQuestion(lastFailedQuestion)}
                  className="shrink-0 rounded-md bg-rose-700 px-3 py-1 font-medium text-white hover:bg-rose-800"
                >
                  Retry
                </button>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Prompt Input Form */}
        <form
          onSubmit={handleFormSubmit}
          className="border-t border-slate-100 p-4 dark:border-slate-800"
        >
          <label htmlFor="ai-question-input" className="sr-only">
            Ask an air quality question
          </label>
          <div className="flex gap-2">
            <input
              id="ai-question-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={800}
              placeholder="Ask about outdoor safety, children's play, indoor filtration, or winter smog…"
              className="h-11 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-sky-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-sky-400"
            />
            <button
              type="submit"
              disabled={sending || input.trim().length < 3}
              className="inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-sky-700 px-4 text-sm font-medium text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Ask Advisor</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
