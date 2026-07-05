import './Canvas.css'

// TODO: this is where the in-progress Worksheet (see
// src/lib/worksheet-model.ts) will live as component state, along with
// the drag-and-drop wiring (likely dnd-kit) that lets a block dragged
// from the Palette get inserted into worksheet.blocks at a given
// position. Selecting a block here should also update whatever state
// the Inspector reads from to know which block it's editing.
export function Canvas() {
  return (
    <div className="canvas">
      <div className="canvas__empty-state">Drag a block here to get started</div>
    </div>
  )
}
