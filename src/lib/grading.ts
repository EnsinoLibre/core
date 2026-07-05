import type { Worksheet } from './worksheet-model'

export interface GradingResult {
  score: number
  maxScore: number
  perBlock: Record<string, unknown>
}

/**
 * Grades a completed worksheet against a student's responses.
 *
 * TODO: this is a stub. The real implementation will delegate to each
 * block's own `grade()` function exported from @ensinolibre/blocks,
 * since only the block itself knows how to check a multiple-choice
 * answer against a fill-in-the-blank answer, etc. This function's job
 * will just be to loop over worksheet.blocks, look up the matching
 * response, call that block's grade(), and total up the results.
 */
export function gradeWorksheet(
  worksheet: Worksheet,
  responses: Record<string, unknown>,
): GradingResult {
  void worksheet
  void responses
  throw new Error('gradeWorksheet is not implemented yet')
}
