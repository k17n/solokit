import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildReviewSummary } from '@solokit/tool-contract';
import { makeContract } from '@solokit/tool-contract/testing';
import { ReviewPanel } from './ReviewPanel';

describe('ReviewPanel', () => {
  it('shows no extra notices for an ordinary agreement', () => {
    render(<ReviewPanel summary={buildReviewSummary(makeContract('nda-mutual'))} />);
    expect(screen.queryByText(/frozen/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Some characters will not print in the PDF')).not.toBeInTheDocument();
  });

  it('says plainly when the wording was frozen under an earlier template', () => {
    const summary = { ...buildReviewSummary(makeContract('nda-mutual')), frozenNote: 'The wording of this agreement was frozen under template version 2026-01-01.1. Read the agreement text itself.' };
    render(<ReviewPanel summary={summary} />);
    expect(screen.getByText('Wording frozen under an earlier template')).toBeInTheDocument();
    expect(screen.getByText(/frozen under template version 2026-01-01.1/)).toBeInTheDocument();
  });

  it('repeats the warning about characters the PDF cannot print', () => {
    const summary = { ...buildReviewSummary(makeContract('nda-mutual')), warnings: ['Some characters (日) will not print in the PDF; the Word version will show them.'] };
    render(<ReviewPanel summary={summary} />);
    expect(screen.getByText('Some characters (日) will not print in the PDF; the Word version will show them.')).toBeInTheDocument();
  });
});
