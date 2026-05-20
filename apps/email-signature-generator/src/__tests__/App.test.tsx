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
