export type EvalMethod = 'llm-judge' | 'command' | 'rule';

export interface BinaryEvalCriterion {
  id: string;
  label: string;
  method: EvalMethod;
  command?: string;
  description: string;
}

export interface BinaryEvalResult {
  criterionId: string;
  passed: boolean;
  reason?: string;
  flaky?: boolean;
}

export interface EvalSuiteResult {
  itemId: string;
  totalPassed: number;
  totalCriteria: number;
  results: BinaryEvalResult[];
}

export function scoreEvalSuite(results: BinaryEvalResult[]): EvalSuiteResult['totalPassed'] {
  return results.filter((result) => result.passed).length;
}

export const defaultContentCriteria: BinaryEvalCriterion[] = [
  {
    id: 'single-h1',
    label: 'Exactly one H1',
    method: 'rule',
    description: 'The generated page should contain exactly one H1.',
  },
  {
    id: 'reader-first-copy',
    label: 'Reader-first copy',
    method: 'llm-judge',
    description: 'Visible copy should sound natural to the reader and avoid internal jargon.',
  },
  {
    id: 'internal-links',
    label: 'Internal linking present',
    method: 'rule',
    description: 'The page should contain relevant first-party internal links.',
  },
  {
    id: 'evidence-threshold',
    label: 'Evidence threshold met',
    method: 'llm-judge',
    description: 'Externally-derived claims should be supported by stable source material.',
  },
];
