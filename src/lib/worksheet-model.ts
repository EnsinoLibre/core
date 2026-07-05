/**
 * A single block placed on a worksheet. `blockType` identifies which
 * block definition (from @ensinolibre/blocks) renders and grades it.
 * `data` is that block's own shape, e.g. its prompt text and answer key,
 * and is intentionally untyped here since each block type defines its own.
 */
export interface WorksheetBlock {
  id: string
  blockType: string
  data: Record<string, unknown>
}

export interface Worksheet {
  id: string
  title: string
  blocks: WorksheetBlock[]
}

/**
 * Builds a fresh, empty worksheet with a generated id and a default
 * title. This is the starting point whenever a teacher clicks
 * "New worksheet".
 */
export function createEmptyWorksheet(title = 'Untitled worksheet'): Worksheet {
  return {
    id: generateId(),
    title,
    blocks: [],
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID (older browsers, some test runners).
  return `worksheet-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
