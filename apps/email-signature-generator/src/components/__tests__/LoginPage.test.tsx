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
import LoginPage from "../LoginPage";

vi.mock("@asgardeo/auth-react", () => ({
  useAuthContext: vi.fn(),
}));

const mockUseAuthContext = vi.mocked(useAuthContext);

describe("LoginPage", () => {
  beforeEach(() => {
    mockUseAuthContext.mockReturnValue({ signIn: vi.fn() } as any);
  });

  it("renders the sign-in button", () => {
    render(<LoginPage />);
    expect(
      screen.getByRole("button", { name: /sign in with asgardeo/i })
    ).toBeInTheDocument();
  });

  it("calls signIn when the button is clicked", () => {
    const mockSignIn = vi.fn();
    mockUseAuthContext.mockReturnValue({ signIn: mockSignIn } as any);
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /sign in with asgardeo/i }));
    expect(mockSignIn).toHaveBeenCalledOnce();
  });

  it("renders the WSO2 logo", () => {
    render(<LoginPage />);
    expect(screen.getByAltText("WSO2")).toBeInTheDocument();
  });
});
