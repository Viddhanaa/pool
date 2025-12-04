import React, { useMemo, useState } from 'react';

interface Point {
  x: number;
  y: number;
  label: string;
}

interface Props {
  points: Point[];
  height?: number;
}

export function BarChart({ points, height = 140 }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const { maxY, range } = useMemo(() => {
    const max = Math.max(...points.map((p) => p.y), 1);
    const min = Math.min(...points.map((p) => p.y), 0);
    return { maxY: max, range: max - min || 1, minY: min };
  }, [points]);

  if (points.length === 0) return <div className="chart-empty muted">No data</div>;

  const formatLabel = (label: string) => {
    try {
      const date = new Date(label);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch (e) {
      // Fall through
    }
    return label;
  };

  return (
    <div className="chart-bar-wrapper" style={{ height }}>
      <svg className="chart" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(93, 244, 194, 0.8)" />
            <stop offset="100%" stopColor="rgba(93, 244, 194, 0.4)" />
          </linearGradient>
          <linearGradient id="barGradientHover" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(93, 244, 194, 1)" />
            <stop offset="100%" stopColor="rgba(93, 244, 194, 0.7)" />
          </linearGradient>
        </defs>
        {points.map((p, i) => {
          const barWidth = 90 / points.length;
          const x = (i * 100) / points.length + (100 - 90) / 2;
          const barHeight = (p.y / maxY) * 90;
          const y = 100 - barHeight;
          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <rect
                x={x}
                y={y}
                width={barWidth - 2}
                height={barHeight}
                fill={hovered === i ? 'url(#barGradientHover)' : 'url(#barGradient)'}
                rx="1"
              />
            </g>
          );
        })}
      </svg>
      {hovered !== null && (
        <div className="chart-tooltip">
          <strong>{formatLabel(points[hovered].label)}</strong>
          <div>{points[hovered].y} min</div>
        </div>
      )}
    </div>
  );
}
