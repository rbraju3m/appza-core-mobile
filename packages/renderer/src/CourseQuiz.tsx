import { useEffect, useState } from 'react';
import { IonIcon } from '@ionic/react';
import type { ActionInvocation } from './actionContext';
import { resolveIcon } from './PrimitiveRenderer';

/**
 * The quiz under a quiz lesson (Courses doc, states 18–21; designs 18–21).
 *
 * ---------------------------------------------------------------------
 * Why a component and not children
 * ---------------------------------------------------------------------
 *
 * The number of questions and of options in each is the course author's,
 * and the picks are the viewer's until SUBMIT — local state no
 * Superstructure child can hold. What stays in the catalog: every word
 * (the AppZet's props), the write (the wired action, named where the
 * snapshot walker looks), and the data (fc-course-lesson's quiz_* fields).
 *
 * ---------------------------------------------------------------------
 * The two modes
 * ---------------------------------------------------------------------
 *
 * ANSWERING (18, 19): one card of questions, then the hint and SUBMIT QUIZ,
 * disabled until every question has an answer. A viewer who is not
 * enrolled gets FC's portal line instead and no submit.
 *
 * RESULT (20, 21), when FC has a saved result and the viewer has not hit
 * Retake: the verdict ("You failed the quiz. Try again!"), Score, Correct
 * answer, Attempts, Retake Quiz, then the questions with the viewer's
 * answers and a Correct / Incorrect bar each — or, with Hide result ON,
 * only "Your quiz has been submitted." Retake clears the picks locally;
 * FC bumps the attempt count on the next submit.
 */

type QuizOption = { label: string };
type QuizQuestion = {
  slug: string;
  type: string;
  label: string;
  multiple: boolean;
  supported: boolean;
  options: QuizOption[];
};
type QuizAnswer = { user_answer: unknown; is_correct: boolean | null };
type QuizResult = {
  status: string;
  score: number;
  correct: number;
  total: number;
  attempts: number;
  answers: Record<string, QuizAnswer>;
};
type Picks = Record<string, string | string[]>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(overrides: Record<string, unknown> | undefined, key: string, fallback: string): string {
  const v = overrides?.[key];
  return typeof v === 'string' && v !== '' ? v : fallback;
}

function readQuestions(v: unknown): QuizQuestion[] {
  if (!Array.isArray(v)) return [];
  const out: QuizQuestion[] = [];
  for (const q of v) {
    if (!isRecord(q) || typeof q.slug !== 'string' || q.slug === '') continue;
    out.push({
      slug: q.slug,
      type: typeof q.type === 'string' ? q.type : '',
      label: typeof q.label === 'string' ? q.label : '',
      multiple: q.multiple === true,
      supported: q.supported !== false,
      options: Array.isArray(q.options)
        ? q.options.filter(isRecord).map((o) => ({ label: String(o.label ?? '') })).filter((o) => o.label !== '')
        : [],
    });
  }
  return out;
}

function readResult(v: unknown): QuizResult | null {
  if (!isRecord(v)) return null;
  const answers: Record<string, QuizAnswer> = {};
  if (isRecord(v.answers)) {
    for (const [slug, a] of Object.entries(v.answers)) {
      if (!isRecord(a)) continue;
      answers[slug] = {
        user_answer: a.user_answer,
        is_correct: typeof a.is_correct === 'boolean' ? a.is_correct : null,
      };
    }
  }
  const n = (x: unknown) => (typeof x === 'number' ? x : Number(x) || 0);
  return {
    status: typeof v.status === 'string' ? v.status : '',
    score: n(v.score),
    correct: n(v.correct),
    total: n(v.total),
    attempts: n(v.attempts),
    answers,
  };
}

/** A saved answer, as the picks the inputs draw from. */
function picksFromResult(result: QuizResult): Picks {
  const picks: Picks = {};
  for (const [slug, a] of Object.entries(result.answers)) {
    if (Array.isArray(a.user_answer)) picks[slug] = a.user_answer.map(String);
    else if (a.user_answer !== null && a.user_answer !== undefined) picks[slug] = String(a.user_answer);
  }
  return picks;
}

function answered(q: QuizQuestion, picks: Picks): boolean {
  const p = picks[q.slug];
  return Array.isArray(p) ? p.length > 0 : typeof p === 'string' && p !== '';
}

export function CourseQuiz({
  overrides,
  action,
  dispatch,
}: {
  overrides: Record<string, unknown> | undefined;
  action?: ActionInvocation;
  dispatch: (inv: ActionInvocation) => void;
}) {
  const questions = readQuestions(overrides?.questions);
  const result = readResult(overrides?.result);
  const canSubmit = overrides?.can_submit === true;
  const hideResult = overrides?.hide_result === true;

  const [retaking, setRetaking] = useState(false);
  const [picks, setPicks] = useState<Picks>({});
  const [submitting, setSubmitting] = useState(false);

  // A new result (FC answered a submit, or another lesson loaded) ends a
  // retake and clears the picks.
  const resultKey = result ? `${result.attempts}:${result.score}:${result.status}` : '';
  const questionsKey = questions.map((q) => q.slug).join('|');
  useEffect(() => {
    setRetaking(false);
    setPicks({});
    setSubmitting(false);
  }, [resultKey, questionsKey]);

  if (questions.length === 0) return null;

  const showResult = result !== null && !retaking;
  const shownPicks = showResult && result ? picksFromResult(result) : picks;
  const gradable = questions.filter((q) => q.supported);
  const allAnswered = gradable.every((q) => answered(q, picks));

  const pick = (q: QuizQuestion, label: string) => {
    if (showResult || !canSubmit) return;
    setPicks((prev) => {
      if (!q.multiple) return { ...prev, [q.slug]: label };
      const cur = Array.isArray(prev[q.slug]) ? (prev[q.slug] as string[]) : [];
      return { ...prev, [q.slug]: cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label] };
    });
  };

  const submit = () => {
    if (!action || !allAnswered || submitting) return;
    setSubmitting(true);
    dispatch({
      ...action,
      item: {
        ...((action.item as Record<string, unknown> | null | undefined) ?? {}),
        answers: picks,
      },
    });
    // The refetch brings the result; if the write fails the button comes
    // back rather than staying greyed forever.
    window.setTimeout(() => setSubmitting(false), 8000);
  };

  const passed = result?.status === 'passed';
  const graded = result !== null && (result.status === 'passed' || result.status === 'failed');

  return (
    <div className="appza-quiz" data-mode={showResult ? 'result' : 'answer'} data-locked={showResult || !canSubmit ? 'true' : undefined}>
      {showResult && result && (
        <>
          <div className="appza-quiz-card appza-quiz-result">
            <div className="appza-quiz-verdict">
              {hideResult || !graded ? (
                <p>{str(overrides, 'submitted_message', 'Your quiz has been submitted.')}</p>
              ) : (
                <>
                  <p>
                    {passed ? str(overrides, 'passed_emoji', '🎉') : ''}
                    {str(overrides, 'you_word', 'You')}{' '}
                    <span className={passed ? 'appza-quiz-passed' : 'appza-quiz-failed'}>
                      {passed ? str(overrides, 'passed_word', 'passed') : str(overrides, 'failed_word', 'failed')}
                    </span>{' '}
                    {str(overrides, 'the_quiz', 'the quiz.')}
                  </p>
                  <p>{passed ? str(overrides, 'passed_line', 'Good job!') : str(overrides, 'failed_line', 'Try again!')}</p>
                </>
              )}
            </div>
            {!hideResult && (
              <div className="appza-quiz-stats">
                <span>
                  {str(overrides, 'score_label', 'Score')} - <b>{result.score}%</b>
                </span>
                <span>
                  {str(overrides, 'correct_label', 'Correct answer')} - <b>{result.correct}/{result.total}</b>
                </span>
                <span>
                  {str(overrides, 'attempts_label', 'Attempts')} - <b>{result.attempts}</b>
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="appza-quiz-card appza-quiz-retake"
            data-appza-inline-click="true"
            onClick={(e) => {
              e.stopPropagation();
              setRetaking(true);
              setPicks({});
            }}
          >
            {str(overrides, 'retake_label', 'Retake Quiz')}
          </button>
        </>
      )}

      <div className="appza-quiz-card appza-quiz-questions">
        {questions.map((q) => {
          const verdict = showResult && result && !hideResult ? result.answers[q.slug]?.is_correct ?? false : null;
          return (
            <div key={q.slug} className="appza-quiz-question" data-question={q.slug}>
              <div className="appza-quiz-label">{q.label}</div>
              {verdict !== null && (
                <div className={`appza-quiz-verdict-bar ${verdict ? 'is-correct' : 'is-incorrect'}`}>
                  <IonIcon icon={resolveIcon(verdict ? 'checkmark' : 'close')} />
                  <span>{verdict ? str(overrides, 'correct_tag', 'Correct') : str(overrides, 'incorrect_tag', 'Incorrect')}</span>
                </div>
              )}
              {q.supported ? (
                q.options.map((o) => {
                  const p = shownPicks[q.slug];
                  const checked = Array.isArray(p) ? p.includes(o.label) : p === o.label;
                  return (
                    <label key={o.label} className="appza-quiz-option" data-appza-inline-click="true" onClick={(e) => e.stopPropagation()}>
                      <input
                        type={q.multiple ? 'checkbox' : 'radio'}
                        name={`appza-quiz-${q.slug}`}
                        checked={checked}
                        // Inert rather than disabled once answered: the
                        // designs draw a result's picks in full blue, and
                        // `disabled` greys them out.
                        readOnly={showResult || !canSubmit}
                        tabIndex={showResult || !canSubmit ? -1 : undefined}
                        onChange={() => pick(q, o.label)}
                      />
                      <span>{o.label}</span>
                    </label>
                  );
                })
              ) : (
                <div className="appza-quiz-unsupported">
                  {str(overrides, 'unsupported_note', 'Answer this question on the website.')}
                </div>
              )}
            </div>
          );
        })}
        {!showResult && (
          <div className="appza-quiz-footer">
            {!canSubmit ? (
              <div className="appza-quiz-hint">
                {str(overrides, 'enroll_hint', 'You need to enroll in this course to take this quiz.')}
              </div>
            ) : (
              <>
                {!allAnswered && (
                  <div className="appza-quiz-hint">{str(overrides, 'hint_label', 'Answer all questions to submit')}</div>
                )}
                <button
                  type="button"
                  className="appza-quiz-submit"
                  data-appza-inline-click="true"
                  disabled={!allAnswered || submitting}
                  onClick={(e) => {
                    e.stopPropagation();
                    submit();
                  }}
                >
                  {str(overrides, 'submit_label', 'SUBMIT QUIZ')}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
