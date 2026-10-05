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

import { Box, Chip, Divider, Paper, Typography } from "@wso2/oxygen-ui";
import { Icon, type IconName } from "./Icon";
import { Sparkline } from "./Sparkline";
import type { Delta } from "@utils/stats";

const SEVERITY_COLOR: Record<Delta["severity"], "success" | "warning" | "error"> = {
  good: "success",
  warning: "warning",
  critical: "error",
};

type PlateCount = number | null | undefined;

interface TodayPanelProps {
  totalKg: number;
  delta?: Delta;
  trend: number[];
  breakfastKg: number;
  lunchKg: number;
  platesBreakfast?: PlateCount;
  platesLunch?: PlateCount;
  platesTotal?: PlateCount;
}

function hasValidPlateCount(count: PlateCount): count is number {
  return count !== undefined && count !== null;
}

function formatPlateCount(count: PlateCount): string {
  if (!hasValidPlateCount(count)) return "--";
  const rounded = Math.round(count);
  return `${rounded} ${rounded === 1 ? "person" : "people"}`;
}

function formatPerPersonAvgParts(wasteKg: number, plateCount: PlateCount): { value: string; unit: string } | null {
  if (!hasValidPlateCount(plateCount) || plateCount <= 0) return null;
  const grams = (wasteKg * 1000) / plateCount;
  if (grams < 1000) return { value: `${Math.round(grams)}`, unit: "g per person" };
  return { value: (grams / 1000).toFixed(2), unit: "kg per person" };
}

function StatRow({
  icon,
  label,
  wasteKg,
  plateCount,
}: {
  icon: IconName;
  label: string;
  wasteKg: number;
  plateCount?: PlateCount;
}) {
  const hasPlates = hasValidPlateCount(plateCount);
  const perPersonParts = formatPerPersonAvgParts(wasteKg, plateCount);

  // The kg total + plate count, demoted to a small caption under the label -
  // number in the primary text color, "kg / N people" in secondary, matching
  // the header total's "27.0 kg / 62 people" color split.
  const captionRest = hasPlates ? `kg / ${formatPlateCount(plateCount)}` : "kg";

  // Per-person average is the headline figure; fall back to the plain kg
  // total when attendance is unknown so the row still has a hero value.
  const heroValue = perPersonParts ? perPersonParts.value : wasteKg.toFixed(1);
  const heroUnit = perPersonParts ? perPersonParts.unit : "kg";

  return (
    <Box className="today-panel__row">
      <span className="today-panel__row-icon">
        <Icon name={icon} />
      </span>
      <Box className="today-panel__row-label">
        <Typography variant="body1" fontWeight={600} noWrap>
          {label}
        </Typography>
        <Typography variant="caption" className="today-panel__row-avg" noWrap>
          <span className="today-panel__row-avg-number">{wasteKg.toFixed(1)}</span> {captionRest}
        </Typography>
      </Box>
      <Box className="today-panel__row-value">
        <Box className="today-panel__row-value-main">
          <Typography component="span" fontWeight={700} noWrap className="today-panel__row-number">
            {heroValue}
          </Typography>
          <Typography component="span" noWrap className="today-panel__row-unit">
            {heroUnit}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export function TodayPanel({
  totalKg,
  delta,
  trend,
  breakfastKg,
  lunchKg,
  platesBreakfast,
  platesLunch,
  platesTotal,
}: TodayPanelProps) {
  const totalPlatesDisplay = hasValidPlateCount(platesTotal) ? formatPlateCount(platesTotal) : null;

  return (
    <Paper elevation={2} className="today-panel">
      <Box className="today-panel__header">
        <Typography variant="overline" sx={{ color: "text.secondary", letterSpacing: "0.06em" }}>
          Today's total waste
        </Typography>

        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap" }}>
          <Typography variant="h3" fontWeight={700} sx={{ fontSize: "3.35rem", letterSpacing: "-0.02em" }}>
            {totalKg.toFixed(1)}
          </Typography>
          <Typography variant="h6" sx={{ fontSize: "1.4rem", color: "text.secondary", fontWeight: 500 }}>
            kg
          </Typography>
          {totalPlatesDisplay && (
            <Typography
              component="span"
              sx={{
                fontSize: "1.15rem",
                color: "text.secondary",
                fontWeight: 500,
              }}
            >
              / {totalPlatesDisplay}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: "2rem" }}>
          {delta && (
            <Chip
              size="small"
              color={SEVERITY_COLOR[delta.severity]}
              label={`${delta.percent > 0 ? "▲" : "▼"} ${Math.abs(delta.percent).toFixed(0)}% vs last week`}
            />
          )}
          {trend.length > 1 && <Sparkline values={trend} lineColor="var(--baseline)" pointColor="var(--accent)" />}
        </Box>
      </Box>

      <Divider sx={{ mt: 1 }} />

      <Box className="today-panel__rows">
        <StatRow icon="sunrise" label="Breakfast" wasteKg={breakfastKg} plateCount={platesBreakfast} />
        <Divider />
        <StatRow icon="utensils" label="Lunch" wasteKg={lunchKg} plateCount={platesLunch} />
      </Box>
    </Paper>
  );
}
