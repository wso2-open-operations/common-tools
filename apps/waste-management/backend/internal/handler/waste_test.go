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

package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/wso2-open-operations/common-tools/apps/waste-management/backend/internal/sheets"
)

type fakeSheetsFetcher struct {
	rows      []sheets.WasteRow
	err       error
	callCount int
}

func (f *fakeSheetsFetcher) FetchRows(_ context.Context) ([]sheets.WasteRow, error) {
	f.callCount++
	if f.err != nil {
		return nil, f.err
	}
	return f.rows, nil
}

func TestWasteHandler_GetWaste_Success(t *testing.T) {
	fake := &fakeSheetsFetcher{rows: []sheets.WasteRow{{Date: "2026-01-01", Breakfast: 4.4, Lunch: 23.2, Total: 27.6, Quarter: "Q1"}}}
	h := NewWasteHandler(fake, time.Minute)

	req := httptest.NewRequest(http.MethodGet, "/api/waste", nil)
	rec := httptest.NewRecorder()
	h.GetWaste(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var body wasteBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(body.Rows) != 1 || body.Rows[0].Date != "2026-01-01" {
		t.Errorf("unexpected rows: %+v", body.Rows)
	}
	if body.CachedAt == "" {
		t.Error("expected a non-empty cachedAt")
	}
}

func TestWasteHandler_GetWaste_CachesWithinTTL(t *testing.T) {
	fake := &fakeSheetsFetcher{rows: []sheets.WasteRow{{Date: "2026-01-01"}}}
	h := NewWasteHandler(fake, time.Minute)

	for range 3 {
		req := httptest.NewRequest(http.MethodGet, "/api/waste", nil)
		h.GetWaste(httptest.NewRecorder(), req)
	}

	if fake.callCount != 1 {
		t.Errorf("FetchRows called %d times, want 1 (should serve from cache)", fake.callCount)
	}
}

func TestWasteHandler_GetWaste_UpstreamError(t *testing.T) {
	fake := &fakeSheetsFetcher{err: errors.New("sheets unavailable")}
	h := NewWasteHandler(fake, time.Minute)

	req := httptest.NewRequest(http.MethodGet, "/api/waste", nil)
	rec := httptest.NewRecorder()
	h.GetWaste(rec, req)

	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadGateway)
	}

	var body errorBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body.Message != ErrMsgUpstream {
		t.Errorf("message = %q, want %q", body.Message, ErrMsgUpstream)
	}
}
