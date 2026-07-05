import { Palette } from '../components/Palette/Palette'
import { Canvas } from '../components/Canvas/Canvas'
import { Inspector } from '../components/Inspector/Inspector'

// Top-level layout: a three-pane workspace.
// Palette (left) lists available blocks, Canvas (center) holds the
// worksheet being built, Inspector (right) edits whatever is selected.
// None of these panes talk to each other yet: that wiring (selection
// state, drag-and-drop, the in-progress Worksheet) comes later.
function App() {
  return (
    <div className="app-layout">
      <aside className="app-layout__palette">
        <Palette />
      </aside>
      <main className="app-layout__canvas">
        <Canvas />
      </main>
      <aside className="app-layout__inspector">
        <Inspector />
      </aside>
    </div>
  )
}

export default App
