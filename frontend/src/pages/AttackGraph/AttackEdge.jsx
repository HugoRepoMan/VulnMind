/** Arista direccional que etiqueta al enfocar y distingue correlaciones por regla. */
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';

export default function AttackEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  markerEnd, data, label
}) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    borderRadius: 8, offset: 22
  });
  const emphasized = data.active || data.hovered;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: data.correlation ? '#d97706' : 'hsl(var(--muted-foreground))',
          strokeWidth: emphasized ? 2.6 : 1.4,
          opacity: data.inactive ? 0.1 : emphasized ? 1 : 0.42
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute max-w-64 rounded border bg-background/95 px-2 py-1 text-[10px] shadow"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            title={data.reason}
          >
            {data.correlation && <span className="mr-1 text-amber-600">Regla ·</span>}
            {data.type.replaceAll('_', ' ')}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
