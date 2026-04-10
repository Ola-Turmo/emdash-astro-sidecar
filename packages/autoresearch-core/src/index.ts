export type MutationOperator =
  | 'add_constraint'
  | 'add_negative_example'
  | 'restructure'
  | 'tighten_language'
  | 'remove_bloat'
  | 'add_counterexample'
  | 'plateau_break';

export interface PromptFamilyDefinition {
  id: string;
  label: string;
  description: string;
  taskType: string;
}

export interface PromptVersion {
  familyId: string;
  versionId: string;
  content: string;
  createdAt: string;
}

export interface BinaryCriterionResult {
  criterionId: string;
  passed: boolean;
  reason?: string;
}

export interface ValidationItemResult {
  itemId: string;
  criterionResults: BinaryCriterionResult[];
}

export interface PromptRunResult {
  runId: string;
  familyId: string;
  promptVersionId: string;
  validationScore: number;
  totalScore: number;
  maxScore: number;
  mutationOperator: MutationOperator;
  kept: boolean;
  createdAt: string;
}

export interface PromptFamilyState {
  familyId: string;
  bestPromptVersionId?: string;
  bestValidationScore: number;
  bestTotalScore: number;
  plateauCounter: number;
}

export function shouldPromotePrompt(
  previousBestValidationScore: number,
  candidateValidationScore: number,
  batchSize: number,
): boolean {
  const confidenceMargin = batchSize >= 8 ? 1 : 2;
  return candidateValidationScore - previousBestValidationScore >= confidenceMargin;
}

export function nextMutationOperator(
  operatorsTried: MutationOperator[],
  plateauCounter: number,
): MutationOperator {
  if (plateauCounter >= 5) return 'plateau_break';

  const cycle: MutationOperator[] = [
    'add_constraint',
    'add_negative_example',
    'restructure',
    'tighten_language',
    'remove_bloat',
    'add_counterexample',
  ];

  return cycle[operatorsTried.length % cycle.length];
}
