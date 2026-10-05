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

import { useEffect, useState } from "react";
import { Box, Chip, CircularProgress, Divider, Typography } from "@wso2/oxygen-ui";
import { useWasteData } from "@hooks/useWasteData";
import { computeStats } from "@utils/stats";
import { TodayPanel } from "@components/TodayPanel";
import { DailyWasteChart } from "@components/DailyWasteChart";
import { TrendChart } from "@components/TrendChart";
import { Wso2Logo } from "@components/Wso2Logo";
import "./App.css";

function formatLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatCachedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function App() {
  const { data, error, isPending } = useWasteData();
  const now = useClock();

  if (error && !data) {
    return (
      <div className="app app--center">
        <p className="error-message">Couldn't load waste data: {error.message}</p>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="app app--center">
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <CircularProgress size={64} thickness={3.6} />
        </Box>
      </div>
    );
  }

  const { rows, cachedAt } = data;

  if (!rows.length) {
    return (
      <div className="app app--center">
        <p className="error-message">No waste data available.</p>
      </div>
    );
  }

  const stats = computeStats(rows);
  const latest = stats.latest!;
  const weeklyData = stats.recent.slice(-7);
  const totalTrend = weeklyData.map((r) => r.total);
  const { platesBreakfast, platesLunch } = latest;
  const platesTotal = platesBreakfast !== null && platesLunch !== null ? platesBreakfast + platesLunch : null;

  return (
    <div className="app">
      <div className="app-top">
        <header className="app-header">
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Wso2Logo />
            <Divider orientation="vertical" flexItem sx={{ height: "2.4rem", alignSelf: "center" }} />
            <Box>
              <Typography variant="h4" fontWeight={700} sx={{ letterSpacing: "-0.01em" }}>
                Food Waste Dashboard
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Latest data: {formatLongDate(latest.date)}
              </Typography>
            </Box>
          </Box>
          <Chip
            label={now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            className="app-header__clock"
          />
        </header>

        {error && (
          <p className="stale-banner">
            Couldn't refresh — showing data cached at {formatCachedTime(cachedAt)}
          </p>
        )}
      </div>

      <div className="dashboard-body">
        <TodayPanel
          totalKg={latest.total}
          delta={stats.weekOverWeek ?? undefined}
          trend={totalTrend}
          breakfastKg={latest.breakfast}
          lunchKg={latest.lunch}
          platesBreakfast={platesBreakfast}
          platesLunch={platesLunch}
          platesTotal={platesTotal}
        />

        <div className="dashboard-main">
          <section className="main-chart">
            <DailyWasteChart data={weeklyData} />
          </section>

          <section className="chart-row">
            <TrendChart title="Monthly waste overview" icon="calendar" data={stats.byMonth} />
            <TrendChart title="Annual waste overview" icon="grid" data={stats.byQuarter} />
          </section>
        </div>
      </div>
    </div>
  );
}

export default App;
