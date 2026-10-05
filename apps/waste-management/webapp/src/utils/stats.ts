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

import type { WasteRow } from "../types";

export interface Delta {
  percent: number;
  isGoodUp: false; // less waste is always the good direction here
  severity: "good" | "warning" | "critical";
}

function severityFor(percentIncrease: number): Delta["severity"] {
  if (percentIncrease <= 0) return "good";
  if (percentIncrease < 10) return "warning";
  return "critical";
}

export interface PeriodPoint {
  label: string;
  perPersonBreakfast: number | null; // kg wasted per person at breakfast
  perPersonLunch: number | null; // kg wasted per person at lunch
}

/** kg wasted per person for one row/meal, or null when attendance is unknown. */
export function perPersonKg(wasteKg: number, plateCount: number | null): number | null {
  if (plateCount === null || plateCount <= 0) return null;
  return wasteKg / plateCount;
}

// Weighted by attendance (sum of waste over sum of plates) rather than
// averaging each day's per-person ratio, so days with more attendees count
// proportionally more - and rows with unknown attendance are excluded from
// both sums instead of silently dragging the average toward zero.
function perPersonAvgForPeriod(
  group: WasteRow[],
  wastePick: (r: WasteRow) => number,
  platesPick: (r: WasteRow) => number | null
): number | null {
  let kgSum = 0;
  let platesSum = 0;
  for (const row of group) {
    const plates = platesPick(row);
    if (plates === null || plates <= 0) continue;
    kgSum += wastePick(row);
    platesSum += plates;
  }
  return platesSum > 0 ? kgSum / platesSum : null;
}

export interface DashboardStats {
  latest: WasteRow | null;
  trailingAvgTotal: number;
  weekOverWeek: Delta | null;
  recent: WasteRow[]; // most recent N rows, oldest first
  byMonth: PeriodPoint[];
  byQuarter: PeriodPoint[];
}

function average(rows: WasteRow[], pick: (r: WasteRow) => number): number {
  if (rows.length === 0) return 0;
  return rows.reduce((sum, r) => sum + pick(r), 0) / rows.length;
}

function toPeriodPoint(label: string, group: WasteRow[]): PeriodPoint {
  return {
    label,
    perPersonBreakfast: perPersonAvgForPeriod(group, (r) => r.breakfast, (r) => r.platesBreakfast),
    perPersonLunch: perPersonAvgForPeriod(group, (r) => r.lunch, (r) => r.platesLunch),
  };
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  const shortMonth = date.toLocaleDateString(undefined, { month: "short" });
  return `${shortMonth} '${year.slice(2)}`;
}

export function computeStats(rows: WasteRow[], recentWindow = 14): DashboardStats {
  if (rows.length === 0) {
    return {
      latest: null,
      trailingAvgTotal: 0,
      weekOverWeek: null,
      recent: [],
      byMonth: [],
      byQuarter: [],
    };
  }

  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const recent = sorted.slice(-recentWindow);
  const trailing7 = sorted.slice(-7);
  const trailingAvgTotal = average(trailing7, (r) => r.total);

  const prior7 = sorted.slice(-14, -7);
  const weekOverWeek: Delta | null =
    prior7.length > 0
      ? (() => {
          const percent =
            ((average(trailing7, (r) => r.total) - average(prior7, (r) => r.total)) /
              average(prior7, (r) => r.total)) *
            100;
          return { percent, isGoodUp: false as const, severity: severityFor(percent) };
        })()
      : null;

  const monthGroups = new Map<string, WasteRow[]>();
  for (const row of sorted) {
    const key = row.date.slice(0, 7); // YYYY-MM
    if (!monthGroups.has(key)) monthGroups.set(key, []);
    monthGroups.get(key)!.push(row);
  }
  const byMonth = [...monthGroups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, group]) => toPeriodPoint(formatMonthLabel(key), group));

  const quarterGroups = new Map<string, WasteRow[]>();
  for (const row of sorted) {
    const key = row.quarter || "Unlabeled";
    if (!quarterGroups.has(key)) quarterGroups.set(key, []);
    quarterGroups.get(key)!.push(row);
  }
  const byQuarter = [...quarterGroups.entries()]
    .map(([label, group]) => toPeriodPoint(label, group))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    latest,
    trailingAvgTotal,
    weekOverWeek,
    recent,
    byMonth,
    byQuarter,
  };
}
