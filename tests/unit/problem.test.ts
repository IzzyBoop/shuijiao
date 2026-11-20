import { describe, expect, it } from 'vitest';
import { StudyError } from '../../src/core/errors';
import { problemFrom } from '../../src/core/ui/problem';

describe('problemFrom', () => {
  it('shows expected errors as they are, with nothing to report', () => {
    expect(problemFrom(new StudyError('You already have a deck called “L1”.'), 'Creating a deck')).toEqual({
      text: 'You already have a deck called “L1”.',
    });
  });

  it('offers a report for anything unexpected, saying what was being done', () => {
    const p = problemFrom(new DOMException('Disk is full', 'QuotaExceededError'), 'Saving a card');
    expect(p.text).toBe('Disk is full');
    expect(p.report).toBe('Saving a card failed.\nQuotaExceededError: Disk is full');
  });

  it('can show its own wording while reporting the underlying error', () => {
    const p = problemFrom(new Error('boom'), 'Saving an answer', 'Could not save your answer: boom');
    expect(p).toEqual({
      text: 'Could not save your answer: boom',
      report: 'Saving an answer failed.\nError: boom',
    });
  });
});
