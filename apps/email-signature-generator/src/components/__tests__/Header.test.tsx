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

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuthContext } from "@asgardeo/auth-react";
import Header from "../Header";

vi.mock("@asgardeo/auth-react", () => ({
  useAuthContext: vi.fn(),
}));

const mockUseAuthContext = vi.mocked(useAuthContext);

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the displayName passed as a prop", () => {
    mockUseAuthContext.mockReturnValue({ signOut: vi.fn() } as any);
    render(<Header displayName="Jane Doe" />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("renders Sign out button", () => {
    mockUseAuthContext.mockReturnValue({ signOut: vi.fn() } as any);
    render(<Header displayName="Jane Doe" />);
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("calls signOut when Sign out button is clicked", () => {
    const mockSignOut = vi.fn();
    mockUseAuthContext.mockReturnValue({ signOut: mockSignOut } as any);
    render(<Header displayName="Jane Doe" />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it("does not render displayName text when empty string is passed", () => {
    mockUseAuthContext.mockReturnValue({ signOut: vi.fn() } as any);
    render(<Header displayName="" />);
    // No Typography with a non-empty display name should appear
    expect(screen.queryByTestId("display-name-text")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("always renders Sign out button regardless of displayName", () => {
    mockUseAuthContext.mockReturnValue({ signOut: vi.fn() } as any);
    render(<Header displayName="" />);
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
