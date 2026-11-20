/**
 * An error the portal expects and explains to the student (a duplicate deck name, a limit
 * reached, nothing to undo). It is shown as it is, with no "Report the problem" link;
 * any other error is unexpected (see core/ui/problem.tsx).
 */
export class StudyError extends Error {
  override name = 'StudyError';
}
