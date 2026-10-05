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

package sheets

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"golang.org/x/oauth2"
	googleoauth "golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	sheetsapi "google.golang.org/api/sheets/v4"
)

// WasteRow is one day's food waste entry read from the Google Sheet.
type WasteRow struct {
	Date            string   `json:"date"` // ISO yyyy-mm-dd
	Breakfast       float64  `json:"breakfast"`
	Lunch           float64  `json:"lunch"`
	Total           float64  `json:"total"`
	Quarter         string   `json:"quarter"`
	PlatesBreakfast *float64 `json:"platesBreakfast"` // nil when the sheet cell is empty/unparseable
	PlatesLunch     *float64 `json:"platesLunch"`
}

var usDateRe = regexp.MustCompile(`^(\d{1,2})/(\d{1,2})/(\d{4})$`)

func toISODate(raw string) (string, bool) {
	m := usDateRe.FindStringSubmatch(strings.TrimSpace(raw))
	if m == nil {
		return "", false
	}
	month, day, year := m[1], m[2], m[3]
	if len(month) == 1 {
		month = "0" + month
	}
	if len(day) == 1 {
		day = "0" + day
	}
	return fmt.Sprintf("%s-%s-%s", year, month, day), true
}

func toFloat(raw string) float64 {
	v, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil {
		return 0
	}
	return v
}

// toFloatOrNil parses raw as a float, returning nil when the cell is blank
// or not a valid number - as opposed to toFloat, which folds that case into
// 0 and so cannot be told apart from a genuine zero reading.
func toFloatOrNil(raw string) *float64 {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	v, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		return nil
	}
	return &v
}

// Config holds everything needed to reach a specific Google Sheet, using a
// user-consented OAuth2 refresh token (obtained once via Google's OAuth
// Playground) rather than a service account.
type Config struct {
	SpreadsheetID string
	Range         string
	ClientID      string
	ClientSecret  string
	RefreshToken  string
}

// Client reads waste rows from one configured Google Sheet.
type Client struct {
	cfg Config
}

// NewClient creates a Client for the given sheet configuration.
func NewClient(cfg Config) *Client {
	return &Client{cfg: cfg}
}

// FetchRows reads the sheet and returns parsed, date-sorted rows.
func (c *Client) FetchRows(ctx context.Context) ([]WasteRow, error) {
	oauthConfig := &oauth2.Config{
		ClientID:     c.cfg.ClientID,
		ClientSecret: c.cfg.ClientSecret,
		Endpoint:     googleoauth.Endpoint,
		Scopes:       []string{sheetsapi.SpreadsheetsReadonlyScope},
	}
	tokenSource := oauthConfig.TokenSource(ctx, &oauth2.Token{RefreshToken: c.cfg.RefreshToken})

	svc, err := sheetsapi.NewService(ctx, option.WithTokenSource(tokenSource))
	if err != nil {
		return nil, fmt.Errorf("creating sheets client: %w", err)
	}

	resp, err := svc.Spreadsheets.Values.Get(c.cfg.SpreadsheetID, c.cfg.Range).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("reading sheet values: %w", err)
	}

	rows := make([]WasteRow, 0, len(resp.Values))
	for _, raw := range resp.Values {
		cell := func(i int) string {
			if i >= len(raw) {
				return ""
			}
			s, _ := raw[i].(string)
			return s
		}

		date, ok := toISODate(cell(0))
		if !ok {
			continue
		}

		rows = append(rows, WasteRow{
			Date:            date,
			Breakfast:       toFloat(cell(1)),
			PlatesBreakfast: toFloatOrNil(cell(2)),
			Lunch:           toFloat(cell(3)),
			PlatesLunch:     toFloatOrNil(cell(4)),
			Total:           toFloat(cell(5)),
			Quarter:         cell(7),
		})
	}

	sort.Slice(rows, func(i, j int) bool { return rows[i].Date < rows[j].Date })
	return rows, nil
}
