import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import '@testing-library/jest-dom';
import { BrowserRouter as Router } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import Navbar from "./Navbar";

// Mock the useAuth0 hook
jest.mock("@auth0/auth0-react");

describe("Navbar", () => {
  const mockLoginWithRedirect = jest.fn();
  const mockLogout = jest.fn();

  beforeEach(() => {
    (useAuth0 as jest.Mock).mockReturnValue({
      loginWithRedirect: mockLoginWithRedirect,
      isAuthenticated: false,
      logout: mockLogout,
    });
  });

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(<Router>{ui}</Router>);
  };

  it("renders the component", () => {
    renderWithRouter(<Navbar />);
    expect(screen.getByText("SyntaxSentinels")).toBeInTheDocument();
  });

  it("renders Log In button when not authenticated", () => {
    renderWithRouter(<Navbar />);
    expect(screen.getByText("Log In")).toBeInTheDocument();
  });

  it("calls loginWithRedirect when Log In button is clicked", () => {
    renderWithRouter(<Navbar />);
    fireEvent.click(screen.getByText("Log In"));
    expect(mockLoginWithRedirect).toHaveBeenCalled();
  });

  it("renders Log Out button when authenticated", () => {
    (useAuth0 as jest.Mock).mockReturnValue({
      loginWithRedirect: mockLoginWithRedirect,
      isAuthenticated: true,
      logout: mockLogout,
    });
    renderWithRouter(<Navbar />);
    expect(screen.getByText("Log Out")).toBeInTheDocument();
  });

  it("calls logout when Log Out button is clicked", () => {
    (useAuth0 as jest.Mock).mockReturnValue({
      loginWithRedirect: mockLoginWithRedirect,
      isAuthenticated: true,
      logout: mockLogout,
    });
    renderWithRouter(<Navbar />);
    fireEvent.click(screen.getByText("Log Out"));
    expect(mockLogout).toHaveBeenCalled();
  });
});