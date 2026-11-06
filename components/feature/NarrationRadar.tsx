/** Diagramme radar 5 axes (styles de narration) — react-native-svg. */
import React from 'react';
import Svg, { Polygon, Line, Text as SvgText, Circle } from 'react-native-svg';
import { NARRATION_AXES, type NarrationScores } from '@/types/simulationNarrationStyles';

type Series = { scores: NarrationScores; color: string; fillOpacity?: number };

export function NarrationRadar({
  series, size = 220, gridColor = '#888', labelColor = '#aaa', showLabels = true,
}: {
  series: Series[];
  size?: number;
  gridColor?: string;
  labelColor?: string;
  showLabels?: boolean;
}) {
  const pad = showLabels ? 42 : 6;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - pad;
  const n = NARRATION_AXES.length;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + Math.cos(a) * r * (v / 5), cy + Math.sin(a) * r * (v / 5)];
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(',')).join(' ');
  return (
    <Svg width={size} height={size}>
      {[1, 2, 3, 4, 5].map((lvl) => (
        <Polygon key={lvl} points={poly(Array(n).fill(lvl))} fill="none" stroke={gridColor} strokeOpacity={0.35} strokeWidth={1} />
      ))}
      {NARRATION_AXES.map((ax, i) => {
        const [x, y] = pt(i, 5);
        const [lx, ly] = pt(i, 6.3);
        return (
          <React.Fragment key={ax.key}>
            <Line x1={cx} y1={cy} x2={x} y2={y} stroke={gridColor} strokeOpacity={0.35} />
            {showLabels ? (
              <SvgText x={lx} y={ly + 4} fontSize={10} fontWeight="700" fill={labelColor} textAnchor="middle">
                {ax.short}
              </SvgText>
            ) : null}
          </React.Fragment>
        );
      })}
      {series.map((s, si) => {
        const vals = NARRATION_AXES.map((ax) => s.scores[ax.key]);
        return (
          <React.Fragment key={si}>
            <Polygon points={poly(vals)} fill={s.color} fillOpacity={s.fillOpacity ?? 0.25} stroke={s.color} strokeWidth={2} />
            {vals.map((v, i) => {
              const [x, y] = pt(i, v);
              return <Circle key={i} cx={x} cy={y} r={3} fill={s.color} />;
            })}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
