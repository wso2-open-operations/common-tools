// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { Paper, Typography } from "@wso2/oxygen-ui";
import type { WasteRow } from "../types";
import { useMeasuredSize } from "@hooks/useMeasuredSize";
import { Icon } from "./Icon";
import { niceTicks, buildLinePath, buildAreaPath } from "@utils/chartMath";
import { perPersonKg } from "@utils/stats";

interface DailyWasteChartProps {
  data: WasteRow[];
}

// Design constants below are tuned for a chart area around this tall (a
// 1920x1080 layout). Everything scales from there so the chart stays
// legible - not just correctly sized - on a 4K panel of the same physical
// TV, where the container measures roughly twice as many CSS px.
const REFERENCE_H = 340;
const BASE_MARGIN = { top: 16, right: 12, bottom: 28, left: 58 };
const BASE_DOT_R = 4;
const BASE_END_DOT_R = 6;
const BASE_AXIS_FONT = 12;
const BASE_VALUE_FONT = 13;

function formatDateShort(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function DailyWasteChart({ data }: DailyWasteChartProps) {
  const { ref, size } = useMeasuredSize<HTMLDivElement>();
  const viewW = Math.max(size.width, 1);
  const viewH = Math.max(size.height, 1);
  const scale = Math.min(Math.max(viewH / REFERENCE_H, 0.7), 2.5);

  const margin = {
    top: BASE_MARGIN.top * scale,
    right: BASE_MARGIN.right * scale,
    bottom: BASE_MARGIN.bottom * scale,
    left: BASE_MARGIN.left * scale,
  };
  const dotR = BASE_DOT_R * scale;
  const endDotR = BASE_END_DOT_R * scale;
  const axisFont = BASE_AXIS_FONT * scale;
  const valueFont = BASE_VALUE_FONT * scale;

  const plotW = Math.max(viewW - margin.left - margin.right, 1);
  const plotH = Math.max(viewH - margin.top - margin.bottom, 1);

  // Per-person waste in grams (easier to read than fractional kg); unknown
  // attendance (null plate count) plots as 0 rather than breaking the line.
  const toGrams = (wasteKg: number, plateCount: number | null) => {
    const perPerson = perPersonKg(wasteKg, plateCount);
    return perPerson !== null ? perPerson * 1000 : 0;
  };
  const breakfastGrams = data.map((d) => toGrams(d.breakfast, d.platesBreakfast));
  const lunchGrams = data.map((d) => toGrams(d.lunch, d.platesLunch));
  // The taller of the two lines at each day - this is what the extreme-day
  // callout below actually points at and labels, so its number always
  // matches the height it's drawn at (using a separate "combined" figure
  // here previously meant the label text didn't match its own position).
  const peakGrams = data.map((_, i) => Math.max(breakfastGrams[i], lunchGrams[i]));

  const ticks = niceTicks(Math.max(...breakfastGrams, ...lunchGrams, 1));
  const maxValue = ticks[ticks.length - 1];
  const yScale = (value: number) => plotH - (value / maxValue) * plotH;
  const xScale = (i: number) => (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);

  const breakfastPoints = breakfastGrams.map((g, i) => ({ x: xScale(i), y: yScale(g) }));
  const lunchPoints = lunchGrams.map((g, i) => ({ x: xScale(i), y: yScale(g) }));

  const worstIndex = peakGrams.reduce((best, g, i) => (best === -1 || g > peakGrams[best] ? i : best), -1);
  const bestIndex = peakGrams.reduce((best, g, i) => (best === -1 || g < peakGrams[best] ? i : best), -1);

  const labelEvery = Math.ceil(data.length / 10);
  const lastIndex = data.length - 1;

  return (
    <Paper elevation={2} className="chart-card">
      <div className="chart-card__header">
        <div className="chart-card__title-group">
          <span className="chart-card__icon">
            <Icon name="trend" />
          </span>
          <div>
            <h2>Weekly waste overview</h2>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Waste per person, in grams
            </Typography>
          </div>
        </div>
        <div className="legend">
          <span className="legend__item">
            <span className="legend__swatch legend__swatch--breakfast" />
            Breakfast
          </span>
          <span className="legend__item">
            <span className="legend__swatch legend__swatch--lunch" />
            Lunch
          </span>
        </div>
      </div>
      <div ref={ref} className="chart-svg-wrap">
        <svg width={viewW} height={viewH} className="chart-svg" role="img" aria-label="Weekly breakfast and lunch waste per person in grams">
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={0}
                  x2={plotW}
                  y1={yScale(tick)}
                  y2={yScale(tick)}
                  className="chart-gridline"
                />
                <text
                  x={-8 * scale}
                  y={yScale(tick)}
                  className="chart-axis-label"
                  style={{ fontSize: axisFont }}
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {tick} g
                </text>
              </g>
            ))}

            <path d={buildAreaPath(lunchPoints, plotH)} className="trend-area-lunch" />
            <path d={buildAreaPath(breakfastPoints, plotH)} className="trend-area-breakfast" />
            <path d={buildLinePath(lunchPoints)} className="trend-line-lunch" />
            <path d={buildLinePath(breakfastPoints)} className="trend-line-breakfast" />

            {data.map((d, i) => {
              const isExtreme = i === worstIndex || i === bestIndex;
              const isLast = i === lastIndex;
              const topY = Math.min(breakfastPoints[i].y, lunchPoints[i].y);
              const textAnchor = i === 0 ? "start" : isLast ? "end" : "middle";

              return (
                <g key={d.date}>
                  <circle
                    cx={lunchPoints[i].x}
                    cy={lunchPoints[i].y}
                    r={isLast ? endDotR : dotR}
                    className={`trend-dot-lunch${isLast ? " trend-dot--end" : ""}`}
                  />
                  <circle
                    cx={breakfastPoints[i].x}
                    cy={breakfastPoints[i].y}
                    r={isLast ? endDotR : dotR}
                    className={`trend-dot-breakfast${isLast ? " trend-dot--end" : ""}`}
                  />
                  {isExtreme && (
                    <text
                      x={xScale(i)}
                      y={topY - 8 * scale}
                      className="chart-value-label"
                      style={{ fontSize: valueFont }}
                      textAnchor={textAnchor}
                    >
                      {Math.round(peakGrams[i])}
                    </text>
                  )}
                  {i % labelEvery === 0 && (
                    <text
                      x={xScale(i)}
                      y={plotH + 18 * scale}
                      className="chart-axis-label"
                      style={{ fontSize: axisFont }}
                      textAnchor={textAnchor}
                    >
                      {formatDateShort(d.date)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </Paper>
  );
}
