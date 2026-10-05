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
import { useMeasuredSize } from "@hooks/useMeasuredSize";
import { niceTicks, buildLinePath, buildAreaPath } from "@utils/chartMath";
import { Icon, type IconName } from "./Icon";
import type { PeriodPoint } from "@utils/stats";

interface TrendChartProps {
  title: string;
  icon: IconName;
  data: PeriodPoint[];
}

// Tuned for this chart's plot area at a 1920x1080 layout; scaled from there
// so it stays legible - not just correctly sized - at 4K. See DailyWasteChart.
const REFERENCE_H = 260;
const BASE_MARGIN = { top: 34, right: 16, bottom: 28, left: 34 };
const BASE_DOT_R = 3.5;
const BASE_END_DOT_R = 5.5;
const BASE_AXIS_FONT = 12;
const BASE_LABEL_FONT = 13;

export function TrendChart({ title, icon, data }: TrendChartProps) {
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
  const labelFont = BASE_LABEL_FONT * scale;

  const plotW = Math.max(viewW - margin.left - margin.right, 1);
  const plotH = Math.max(viewH - margin.top - margin.bottom, 1);

  // Per-person waste in grams (easier to read than fractional kg); an
  // unknown attendance count (null) plots as 0 rather than breaking the line.
  const toGrams = (perPersonKg: number | null) => (perPersonKg ?? 0) * 1000;
  const breakfastGrams = data.map((d) => toGrams(d.perPersonBreakfast));
  const lunchGrams = data.map((d) => toGrams(d.perPersonLunch));

  const ticks = niceTicks(Math.max(...breakfastGrams, ...lunchGrams, 1));
  const maxValue = ticks[ticks.length - 1];
  const yScale = (value: number) => plotH - (value / maxValue) * plotH;
  const xScale = (i: number) => (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);

  const breakfastPoints = breakfastGrams.map((g, i) => ({ x: xScale(i), y: yScale(g) }));
  const lunchPoints = lunchGrams.map((g, i) => ({ x: xScale(i), y: yScale(g) }));

  const lastBreakfast = breakfastPoints[breakfastPoints.length - 1];
  const lastLunch = lunchPoints[lunchPoints.length - 1];

  // Nudge the two end-labels apart vertically if their points sit close together.
  let breakfastLabelY = lastBreakfast ? lastBreakfast.y - 12 * scale : 0;
  let lunchLabelY = lastLunch ? lastLunch.y - 12 * scale : 0;
  if (lastBreakfast && lastLunch) {
    const minGap = 18 * scale;
    if (Math.abs(breakfastLabelY - lunchLabelY) < minGap) {
      const mid = (breakfastLabelY + lunchLabelY) / 2;
      if (breakfastLabelY <= lunchLabelY) {
        breakfastLabelY = mid - minGap / 2;
        lunchLabelY = mid + minGap / 2;
      } else {
        breakfastLabelY = mid + minGap / 2;
        lunchLabelY = mid - minGap / 2;
      }
    }
  }

  const labelEvery = Math.max(1, Math.ceil(data.length / 9));

  return (
    <Paper elevation={2} className="chart-card">
      <div className="chart-card__header">
        <div className="chart-card__title-group">
          <span className="chart-card__icon">
            <Icon name={icon} />
          </span>
          <div>
            <h2>{title}</h2>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
              Avg g/person
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
        <svg width={viewW} height={viewH} className="chart-svg" role="img" aria-label={title}>
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={0} x2={plotW} y1={yScale(tick)} y2={yScale(tick)} className="chart-gridline" />
                <text
                  x={-8 * scale}
                  y={yScale(tick)}
                  className="chart-axis-label"
                  style={{ fontSize: axisFont }}
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {tick}
                </text>
              </g>
            ))}

            <path d={buildAreaPath(lunchPoints, plotH)} className="trend-area-lunch" />
            <path d={buildAreaPath(breakfastPoints, plotH)} className="trend-area-breakfast" />
            <path d={buildLinePath(lunchPoints)} className="trend-line-lunch" />
            <path d={buildLinePath(breakfastPoints)} className="trend-line-breakfast" />

            {breakfastPoints.map((p, i) => (
              <circle key={`b${i}`} cx={p.x} cy={p.y} r={dotR} className="trend-dot-breakfast" />
            ))}
            {lunchPoints.map((p, i) => (
              <circle key={`l${i}`} cx={p.x} cy={p.y} r={dotR} className="trend-dot-lunch" />
            ))}

            {lastBreakfast && (
              <>
                <circle cx={lastBreakfast.x} cy={lastBreakfast.y} r={endDotR} className="trend-dot-breakfast trend-dot--end" />
                <text
                  x={lastBreakfast.x}
                  y={breakfastLabelY}
                  className="chart-value-label"
                  style={{ fontSize: labelFont }}
                  textAnchor="end"
                >
                  {Math.round(breakfastGrams[breakfastGrams.length - 1])}
                </text>
              </>
            )}
            {lastLunch && (
              <>
                <circle cx={lastLunch.x} cy={lastLunch.y} r={endDotR} className="trend-dot-lunch trend-dot--end" />
                <text
                  x={lastLunch.x}
                  y={lunchLabelY}
                  className="chart-value-label"
                  style={{ fontSize: labelFont }}
                  textAnchor="end"
                >
                  {Math.round(lunchGrams[lunchGrams.length - 1])}
                </text>
              </>
            )}

            {data.map((d, i) =>
              i % labelEvery === 0 || i === data.length - 1 ? (
                <text
                  key={d.label}
                  x={xScale(i)}
                  y={plotH + 18 * scale}
                  className="chart-axis-label"
                  style={{ fontSize: axisFont }}
                  textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                >
                  {d.label}
                </text>
              ) : null
            )}
          </g>
        </svg>
      </div>
    </Paper>
  );
}
