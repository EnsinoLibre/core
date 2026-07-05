import './Palette.css'

// Once @ensinolibre/blocks is installed, this becomes:
//   import { blockRegistry } from '@ensinolibre/blocks'
// and we map over blockRegistry to list every block type the app
// supports, each draggable onto the Canvas.
const placeholderBlockTypes = ['Multiple choice', 'Fill in the blank', 'Short answer']

export function Palette() {
  return (
    <div className="palette">
      <h2 className="palette__title">Blocks</h2>
      <ul className="palette__list">
        {placeholderBlockTypes.map((blockType) => (
          <li key={blockType} className="palette__item">
            {blockType}
          </li>
        ))}
      </ul>
    </div>
  )
}
