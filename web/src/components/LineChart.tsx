import React, { useMemo, useState } from 'react';

interface Point { x: number; y: number; label: string }

export function LineChart({ points, height = 140 }: { points: Point[]; height?: number }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { minY, range } = useMemo(() => {
    if (points.length === 0) return { minY: 0, range: 1 };
    const maxY = Math.max(...points.map((p) => p.y), 1);
    const min = Math.min(...points.map((p) => p.y), 0);
    return { minY: min, range: maxY - min || 1 };
  }, [points]);

  if (points.length === 0) return <div className="chart-empty muted">No data</div>;

  const path = points
    .map((p, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * 100;
      const y = 100 - ((p.y - minY) / range) * 100;
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    })
    .join(' ');

  const pointCoords = points.map((p, i) => {
    const x = (i / Math.max(points.length - 1, 1)) * 100;
    const y = 100 - ((p.y - minY) / range) * 100;
    return { x, y };
  });

  const formatLabel = (label: string) => {
    try {
      const date = new Date(label);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(', ', ' ');
      }
    } catch (e) {
      // Fall through to return label as-is
    }
    return label;
  };

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toFixed(2);
  };

  // Create area path for gradient fill
  const areaPath = points.length > 0
    ? path + ` L ${pointCoords[pointCoords.length - 1].x},100 L ${pointCoords[0].x},100 Z`
    : '';

  return (
    <div className="chart-wrapper" style={{ height }}>
      <svg className="chart" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(93, 244, 194, 0.3)" />
            <stop offset="100%" stopColor="rgba(93, 244, 194, 0.02)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Area fill with gradient */}
        <path d={areaPath} fill="url(#lineGradient)" opacity="0.5" />
        
        {/* Main line with glow */}
        <path 
          d={path} 
          fill="none" 
          stroke="var(--accent)" 
          strokeWidth={2.5} 
          vectorEffect="non-scaling-stroke"
          filter="url(#glow)"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Data points */}
        {pointCoords.map((p, i) => (
          <g key={i}>
            {hovered === i && (
              <circle
                cx={p.x}
                cy={p.y}
                r={4}
                fill="var(--accent)"
                opacity="0.2"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={2}
              fill={hovered === i ? 'var(--accent)' : 'rgba(143, 180, 255, 0.8)'}
              stroke={hovered === i ? '#fff' : 'var(--accent)'}
              strokeWidth={hovered === i ? 1 : 0.5}
              vectorEffect="non-scaling-stroke"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            />
          </g>
        ))}
      </svg>
      {hovered !== null && (
        <div className="chart-tooltip">
          <strong>{formatLabel(points[hovered].label)}</strong>
          <div>{formatValue(points[hovered].y)}</div>
        </div>
      )}
    </div>
  );
}
