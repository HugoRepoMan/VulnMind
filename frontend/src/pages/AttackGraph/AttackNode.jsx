/** Nodo SOC con severidad, tooltip, handles y control de colapso del activo. */
import { Handle, Position } from '@xyflow/react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const palette = {
  ENTRY: 'border-sky-400/70 bg-sky-500/10',
  ASSET: 'border-blue-400/70 bg-blue-500/10',
  SERVICE: 'border-violet-400/70 bg-violet-500/10',
  VULNERABILITY: 'border-rose-400/70 bg-rose-500/10',
  IDENTITY: 'border-amber-400/70 bg-amber-500/10',
  EVIDENCE: 'border-emerald-400/70 bg-emerald-500/10'
};
const severityStyle = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH: 'bg-orange-500 text-white',
  MEDIUM: 'bg-amber-400 text-black',
  LOW: 'bg-sky-500 text-white'
};
const handlePositions = { top: '25%', middle: '50%', bottom: '75%' };

export default function AttackNode({ data, selected }) {
  const inactive = data.active === false || data.related === false;
  return (
    <div
      className={`relative h-full w-full rounded-xl border px-4 py-3 shadow-sm transition-all ${palette[data.type]} ${selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''} ${inactive ? 'opacity-20' : 'opacity-100'}`}
      title={`${data.label}${data.subtitle ? ` — ${data.subtitle}` : ''}`}
    >
      {Object.entries(handlePositions).map(([name, top]) => (
        <Handle
          key={`in-${name}`}
          id={`in-${name}`}
          type="target"
          position={Position.Left}
          style={{ top }}
          className="!h-2 !w-2 !border-background !bg-muted-foreground"
        />
      ))}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {data.typeLabel}
          </p>
          <p className="truncate text-sm font-semibold">{data.label}</p>
        </div>
        {data.severity && (
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${severityStyle[data.severity] || 'bg-secondary'}`}>
            {data.severity}
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground" title={data.subtitle}>
        {data.subtitle || (data.riskScore !== undefined ? `Riesgo ${Math.round(data.riskScore)}/100` : 'Sin detalle adicional')}
      </p>
      {data.type === 'ASSET' && (
        <button
          type="button"
          className="nodrag mt-2 flex items-center gap-1 text-[10px] font-medium text-primary"
          onClick={(event) => {
            event.stopPropagation();
            data.onToggle?.(data.assetId);
          }}
        >
          {data.collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {data.collapsed ? 'Expandir' : 'Colapsar'} · {data.serviceCount || 0} servicios · {data.findingCount || 0} hallazgos
        </button>
      )}
      {Object.entries(handlePositions).map(([name, top]) => (
        <Handle
          key={`out-${name}`}
          id={`out-${name}`}
          type="source"
          position={Position.Right}
          style={{ top }}
          className="!h-2 !w-2 !border-background !bg-muted-foreground"
        />
      ))}
    </div>
  );
}
