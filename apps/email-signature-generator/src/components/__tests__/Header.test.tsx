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
