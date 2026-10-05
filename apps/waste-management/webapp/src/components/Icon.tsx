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

export type IconName = "sunrise" | "utensils" | "trend" | "calendar" | "grid";

const PATHS: Record<IconName, string> = {
  sunrise:
    "M12 3v3m7.07 2.93-2.12 2.12M4.93 8.93l2.12 2.12M3 15h18M6 15a6 6 0 0 1 12 0M2 19h20",
  utensils:
    "M7 3v7a1 1 0 0 1-2 0V3m-1 0v7a2 2 0 0 0 2 2v9m4-18v18m5-18a3 3 0 0 0-3 3v4a2 2 0 0 0 2 2h1v9",
  trend: "m4 15 5-5 4 4 7-8m0 0h-5m5 0v5",
  calendar:
    "M7 2v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
};

interface IconProps {
  name: IconName;
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
