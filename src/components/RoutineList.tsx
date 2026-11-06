import type { Routine } from '../types/domain'
import { amountLabel } from '../lib/format'

export default function RoutineList({ routine }: { routine: Routine }) {
  return (
    <ol className="grid" style={{ padding: 0, margin: 0, listStyle: 'none' }}>
      {routine.items.map((it) => (
        <li key={it.exerciseId} className="card row" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700 }}>
            {it.order}. {it.name}
          </span>
          <span className="muted">{amountLabel(it)}</span>
        </li>
      ))}
    </ol>
  )
}
