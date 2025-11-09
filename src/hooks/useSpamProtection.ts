import { useCallback, useEffect, useMemo, useRef } from 'react';

export type SpamSubmissionMetadata = {
  honeyputValue: string;
  timeToSubmitMs: number;
};

export function useSpamProtection(fieldName = 'honeyput') {
  const startTimeRef = useRef<number>(Date.now());
  const honeyputRef = useRef<HTMLInputElement | null>(null);

  const resetProtection = useCallback(() => {
    startTimeRef.current = Date.now();
    if (honeyputRef.current) {
      honeyputRef.current.value = '';
    }
  }, []);

  useEffect(() => {
    resetProtection();
  }, [resetProtection]);

  const honeyputInputProps = useMemo(
    () => ({
      ref: honeyputRef,
      id: fieldName,
      name: fieldName,
      tabIndex: -1,
      autoComplete: 'off',
      className: 'hidden',
      'aria-hidden': 'true' as const,
    }),
    [fieldName]
  );

  const getSubmissionMetadata = useCallback((): SpamSubmissionMetadata => ({
    honeyputValue: honeyputRef.current?.value ?? '',
    timeToSubmitMs: Date.now() - startTimeRef.current,
  }), []);

  return {
    honeyputInputProps,
    getSubmissionMetadata,
    resetProtection,
  } as const;
}
