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

import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuthContext } from "@asgardeo/auth-react";
import App from "../App";

vi.mock("@asgardeo/auth-react", () => ({
  useAuthContext: vi.fn(),
}));

vi.mock("../components/LoginPage", () => ({
  default: () => <div data-testid="login-page" />,
}));

vi.mock("../components/Header", () => ({
  default: ({ displayName }: { displayName: string }) => (
    <div data-testid="header">{displayName}</div>
  ),
}));

vi.mock("../components/SignatureForm", () => ({
  default: () => <div data-testid="signature-form" />,
}));

vi.mock("../components/SignaturePreview", () => ({
  default: () => <div data-testid="signature-preview" />,
}));

const mockUseAuthContext = vi.mocked(useAuthContext);

describe("App auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading spinner while auth state is resolving", () => {
    mockUseAuthContext.mockReturnValue({
      state: { isLoading: true, isAuthenticated: false },
      getBasicUserInfo: vi.fn(),
    } as any);
    render(<App />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows LoginPage when not authenticated", () => {
    mockUseAuthContext.mockReturnValue({
      state: { isLoading: false, isAuthenticated: false },
      getBasicUserInfo: vi.fn(),
    } as any);
    render(<App />);
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
  });

  it("shows Header, SignatureForm, and SignaturePreview when authenticated", () => {
    mockUseAuthContext.mockReturnValue({
      state: { isLoading: false, isAuthenticated: true },
      getBasicUserInfo: vi.fn().mockResolvedValue({ displayName: "Jane Doe" }),
    } as any);
    render(<App />);
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("signature-form")).toBeInTheDocument();
    expect(screen.getByTestId("signature-preview")).toBeInTheDocument();
  });

  it("calls getBasicUserInfo once after authentication", async () => {
    const mockGetBasicUserInfo = vi
      .fn()
      .mockResolvedValue({ displayName: "Jane Doe" });
    mockUseAuthContext.mockReturnValue({
      state: { isLoading: false, isAuthenticated: true },
      getBasicUserInfo: mockGetBasicUserInfo,
    } as any);
    render(<App />);
    await waitFor(() =>
      expect(mockGetBasicUserInfo).toHaveBeenCalledOnce()
    );
  });

  it("passes displayName to Header after profile fetch", async () => {
    mockUseAuthContext.mockReturnValue({
      state: { isLoading: false, isAuthenticated: true },
      getBasicUserInfo: vi.fn().mockResolvedValue({ displayName: "Jane Doe" }),
    } as any);
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("header")).toHaveTextContent("Jane Doe")
    );
  });
});
