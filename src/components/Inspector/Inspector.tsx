import './Inspector.css'

// TODO: once a block is selected on the Canvas, this panel will look up
// that block's definition in @ensinolibre/blocks and render its Editor
// component, passing the block's current data and an onChange handler
// that writes back into the Worksheet held by the Canvas.
export function Inspector() {
  return (
    <div className="inspector">
      <p className="inspector__empty-state">Select a block to edit its settings</p>
    </div>
  )
}
