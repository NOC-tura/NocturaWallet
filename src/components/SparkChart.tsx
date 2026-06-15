import React from 'react';
import {View} from 'react-native';
import Svg, {Path, Circle} from 'react-native-svg';

export interface SparkPath {
  line: string;
  area: string;
  firstY: number;
  lastX: number;
  lastY: number;
}

/**
 * Map a price series to SVG path `d` strings, normalized to [pad, height-pad].
 * x is evenly spaced across width. Returns empty strings for <2 points.
 */
export function seriesToPath(
  prices: number[],
  width: number,
  height: number,
): SparkPath {
  if (prices.length < 2)
    return {line: '', area: '', firstY: 0, lastX: 0, lastY: 0};

  const pad = 8;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1; // flat series → avoid /0
  const innerH = height - pad * 2;
  const n = prices.length;

  const x = (i: number) => (i / (n - 1)) * width;
  const y = (p: number) => pad + (1 - (p - min) / span) * innerH;

  const pts = prices.map((p, i) => `${x(i).toFixed(2)},${y(p).toFixed(2)}`);
  const line = 'M' + pts.join(' L');
  const area =
    `M${x(0).toFixed(2)},${height} L` +
    pts.join(' L') +
    ` L${width.toFixed(2)},${height} Z`;

  return {
    line,
    area,
    firstY: y(prices[0]),
    lastX: x(n - 1),
    lastY: y(prices[n - 1]),
  };
}

interface SparkChartProps {
  prices: number[];
  width?: number;
  height?: number;
  up: boolean;
}

export function SparkChart({
  prices,
  width = 360,
  height = 120,
  up,
}: SparkChartProps) {
  const {line, area, lastX, lastY} = seriesToPath(prices, width, height);
  const color = up ? '#3FD68B' : '#F87171';

  if (!line) return <View style={{height}} />;

  return (
    <Svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <Path d={area} fill={color} fillOpacity={0.12} />
      <Path d={line} stroke={color} strokeWidth={2} fill="none" />
      <Circle cx={lastX} cy={lastY} r={4} fill={color} />
    </Svg>
  );
}

export function SparkChartSkeleton({height = 120}: {height?: number}) {
  return <View style={{height}} className="bg-bg-surface-2 rounded-lg" />;
}
