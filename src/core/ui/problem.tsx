import { StudyError } from '../errors';
import { reportProblemUrl } from '../report';
import { ExternalLink } from './ExternalLink';
import { errorMessage } from './useAsync';

export { StudyError } from '../errors';

/** A message for the student, and, for unexpected failures, details for a report. */
export interface Problem {
  text: string;
  /** Present when it's worth reporting: what was being done, and the error. */
  report?: string;
}

/**
 * Turns a caught error into a Problem. Expected errors (StudyError) are just shown;
 * anything else is unexpected, so it gets a "Report the problem" link.
 */
export function problemFrom(err: unknown, doing: string, text = errorMessage(err)): Problem {
  if (err instanceof StudyError) return { text: err.message };
  const name = err instanceof Error ? `${err.name}: ` : '';
  return { text, report: `${doing} failed.\n${name}${errorMessage(err)}` };
}

/** A Problem, or a plain message (which is never reported). */
export type ProblemOrText = Problem | string;

const asProblem = (p: ProblemOrText): Problem => (typeof p === 'string' ? { text: p } : p);

/** The message to show. */
export const problemText = (p: ProblemOrText): string => asProblem(p).text;

/** The report link on its own, for messages laid out by the caller. */
export function ReportLink({ problem }: { problem: ProblemOrText }) {
  const { report } = asProblem(problem);
  if (report === undefined) return null;
  return (
    <>
      {' '}
      <ExternalLink url={reportProblemUrl(report)}>Report the problem</ExternalLink>
    </>
  );
}

/** An error message, with a "Report the problem" link when it's an unexpected failure. */
export function ProblemNotice({ problem }: { problem: ProblemOrText }) {
  return (
    <div class="notice error" role="alert">
      <span class="grow">
        {asProblem(problem).text}
        <ReportLink problem={problem} />
      </span>
    </div>
  );
}
