// Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
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

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios, { HttpStatusCode } from "axios";

import { AppConfig } from "@config/config";
import { SnackMessage } from "@config/constant";
import { enqueueSnackbarMessage } from "@slices/commonSlice/common";
import { APIService } from "@utils/apiService";

import { State } from "@/types/types";

interface SupportTeamEmail {
  team: string;
  email: string;
}

interface AppConfigInfo {
  supportTeamEmails: SupportTeamEmail[];
}

interface AppConfigState {
  state: State;
  stateMessage: string | null;
  errorMessage: string | null;
  config: AppConfigInfo | null;
}

const initialState: AppConfigState = {
  state: State.idle,
  stateMessage: null,
  errorMessage: null,
  config: null,
};

export const fetchAppConfig = createAsyncThunk(
  "appConfig/fetchAppConfig",
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const response = await APIService.getInstance().get(
        AppConfig.serviceUrls.appConfig,
      );
      return response.data as AppConfigInfo;
    } catch (error) {
      if (axios.isCancel(error)) {
        return rejectWithValue("Request canceled");
      }
      const message =
        (error as any).response?.data?.message ||
        (error as Error).message ||
        "An unknown error occurred.";
      dispatch(
        enqueueSnackbarMessage({
          message:
            (error as any).response?.status === HttpStatusCode.InternalServerError
              ? SnackMessage.error.fetchAppConfigMessage
              : message,
          type: "error",
        }),
      );
      return rejectWithValue(message);
    }
  },
);

const AppConfigSlice = createSlice({
  name: "appConfig",
  initialState,
  reducers: {
    resetSubmitState(state) {
      state.state = State.idle;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAppConfig.pending, (state) => {
        state.state = State.loading;
        state.stateMessage = "Fetching application configurations...";
      })
      .addCase(fetchAppConfig.fulfilled, (state, action) => {
        state.state = State.success;
        state.stateMessage = "Successfully fetched app configurations!";
        state.config = action.payload;
      })
      .addCase(fetchAppConfig.rejected, (state, action) => {
        state.state = State.failed;
        state.stateMessage = "Failed to fetch application configurations.";
        state.errorMessage =
          (action.payload as string) ?? action.error?.message ?? null;
      });
  },
});

export const { resetSubmitState } = AppConfigSlice.actions;
export default AppConfigSlice.reducer;
