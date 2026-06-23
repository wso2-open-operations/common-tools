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

// Turns a failed job's backend error (the same text the server logs) into a message for the error box; falls back when empty.
export const describeJobError = (error?: string): string => {
  const msg = error?.trim();
  if (!msg) return 'The server could not process the uploaded files. Please check the files and try again.';
  // Unexpected failures return a deliberately generic line; keep only the reference id so users can match it to the server logs.
  if (/^internal error \(ref=/i.test(msg)) {
    return `Something went wrong while analyzing your files. Please try again. (${msg.replace(/^internal error /i, '')})`;
  }
  // Validation, timeout, and parse reasons are already human-readable; multiple file problems arrive joined by "; ", so show one per line.
  return msg.replace(/; /g, '\n');
};
