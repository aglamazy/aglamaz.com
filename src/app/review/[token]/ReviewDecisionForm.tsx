'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  token: string;
}

export default function ReviewDecisionForm({ token }: Props) {
  const [decision, setDecision] = useState<'approved' | 'changes_requested' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!decision) return;
    if (decision === 'changes_requested' && !feedback.trim()) {
      setError('Please provide feedback when requesting changes.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      // Deliberately native fetch, not apiFetch: this is a public, token-gated route
      // with no member session — apiFetch's auth headers don't apply here (the
      // reviewToken itself is the auth, see api/review/[token]/route.ts).
      // eslint-disable-next-line no-restricted-globals
      const res = await fetch(`/api/review/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          feedback: decision === 'changes_requested' ? feedback : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as any).error || 'Failed to submit review.');
        return;
      }
      setDone(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-lg font-semibold text-green-800">
          {decision === 'approved'
            ? 'Post approved and published!'
            : 'Feedback sent to the author.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Your Review</h2>
      <div className="flex flex-wrap gap-3">
        <Button
          variant={decision === 'approved' ? 'primary' : 'outline'}
          onClick={() => { setDecision('approved'); setError(''); }}
          disabled={submitting}
        >
          Approve &amp; Publish
        </Button>
        <Button
          variant={decision === 'changes_requested' ? 'primary' : 'outline'}
          onClick={() => { setDecision('changes_requested'); setError(''); }}
          disabled={submitting}
        >
          Request Changes
        </Button>
      </div>
      {decision === 'changes_requested' && (
        <textarea
          className="h-32 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          placeholder="Your feedback for the author..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          disabled={submitting}
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {decision && (
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Review'}
        </Button>
      )}
    </div>
  );
}
