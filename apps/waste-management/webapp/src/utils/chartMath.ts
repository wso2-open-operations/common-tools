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

export function niceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  for (const step of steps) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

// Produces `tickCount + 1` evenly spaced axis ticks (0, step, 2*step, ...)
// where the step itself is rounded to a nice number first. Deriving ticks by
// slicing a nice max into equal fractions (maxTotal * 0.25, etc.) produces
// awkward values like 13/38 whenever maxTotal isn't a multiple of 4 - rounding
// the step instead keeps every tick a clean, evenly spaced number.
export function niceTicks(maxValue: number, tickCount = 4): number[] {
  const rawStep = (maxValue > 0 ? maxValue : 1) / tickCount;
  const step = niceMax(rawStep);
  return Array.from({ length: tickCount + 1 }, (_, i) => i * step);
}

export function buildLinePath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}

export function buildAreaPath(points: { x: number; y: number }[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${buildLinePath(points)} L${last.x},${baselineY} L${first.x},${baselineY} Z`;
}
