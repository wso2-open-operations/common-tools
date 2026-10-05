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

/**
 * Build-time stand-in for `@mui/x-data-grid` (see `resolve.alias` in
 * vite.config.ts). Oxygen UI's bundle styles the MUI X Data Grid at module
 * top level for its ListingTable, which drags ~350 KB (minified) into the
 * entry chunk of every app that imports Oxygen - this dashboard renders no
 * tables at all. If a screen ever needs ListingTable / DataGrid, delete the
 * alias and this file.
 */

/* eslint-disable react-refresh/only-export-components -- a build stub mirroring a library's export surface, never hot-reloaded */

import { type JSX } from "react";

const MESSAGE =
  "@mui/x-data-grid is stubbed out of this bundle (vite.config.ts resolve.alias). Remove the alias to use DataGrid / ListingTable.";

export function DataGrid(): JSX.Element {
  throw new Error(MESSAGE);
}

export const GridToolbar = DataGrid;
export const GridActionsCellItem = DataGrid;
export const useGridApiRef = (): never => {
  throw new Error(MESSAGE);
};
