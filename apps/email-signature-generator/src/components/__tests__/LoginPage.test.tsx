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
