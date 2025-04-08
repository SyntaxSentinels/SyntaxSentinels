import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import '@testing-library/jest-dom';
import { BrowserRouter as Router } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import Index from "./Index";

// Mock the useAuth0 hook
jest.mock("@auth0/auth0-react");

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

describe("Index", () => {
  const mockLoginWithRedirect = jest.fn();
  const mockGetAccessTokenSilently = jest.fn().mockResolvedValue("mock-token");

  beforeEach(() => {
    (useAuth0 as jest.Mock).mockReturnValue({
      loginWithRedirect: mockLoginWithRedirect,
      isAuthenticated: false,
      isLoading: false,
      getAccessTokenSilently: mockGetAccessTokenSilently,
    });
  });

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(<Router>{ui}</Router>);
  };

  it("renders the component", () => {
    renderWithRouter(<Index />);
    expect(screen.getByText("Verify Academic and Contest Submissions")).toBeInTheDocument();
    expect(screen.getByText("Empower educators and contest administrators with advanced AI-powered plagiarism detection. Ensure the integrity of student work and competition submissions.")).toBeInTheDocument();
  });

  it("displays loading spinner when loading", () => {
    (useAuth0 as jest.Mock).mockReturnValue({
      loginWithRedirect: mockLoginWithRedirect,
      isAuthenticated: false,
      isLoading: true,
      getAccessTokenSilently: mockGetAccessTokenSilently,
    });
    renderWithRouter(<Index />);
    expect(screen.getByText("Preparing your experience...")).toBeInTheDocument();
  });

  it("calls loginWithRedirect when Get Started button is clicked", () => {
    renderWithRouter(<Index />);
    fireEvent.click(screen.getByText("Get Started"));
    expect(mockLoginWithRedirect).toHaveBeenCalled();
  });

  it("navigates to /home when authenticated", async () => {
    (useAuth0 as jest.Mock).mockReturnValue({
      loginWithRedirect: mockLoginWithRedirect,
      isAuthenticated: true,
      isLoading: false,
      getAccessTokenSilently: mockGetAccessTokenSilently,
    });

    renderWithRouter(<Index />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/home"));
  });

  it("displays features section", () => {
    renderWithRouter(<Index />);
    expect(screen.getByText("Why Choose SyntaxSentinels?")).toBeInTheDocument();
    expect(screen.getByText("Advanced algorithms detect similarities across multiple languages and document formats")).toBeInTheDocument();
    expect(screen.getByText("Analyze multiple submissions simultaneously for efficient grading and evaluation")).toBeInTheDocument();
    expect(screen.getByText("Get comprehensive originality reports with source citations and similarity percentages")).toBeInTheDocument();
  });

  it("displays how it works section", () => {
    renderWithRouter(<Index />);
    expect(screen.getByText("How It Works")).toBeInTheDocument();
    expect(screen.getByText("Upload student or contestant submissions")).toBeInTheDocument();
    expect(screen.getByText("Our AI analyzes content against other submissions")).toBeInTheDocument();
    expect(screen.getByText("Review detailed originality reports")).toBeInTheDocument();
  });

  it("displays footer", () => {
    renderWithRouter(<Index />);
    expect(screen.getByText("© 2024 SyntaxSentinels. All rights reserved.")).toBeInTheDocument();
  });
});