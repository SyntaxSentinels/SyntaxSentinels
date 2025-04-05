import React from "react";
import { render, screen } from "@testing-library/react";
import '@testing-library/jest-dom';
import Features from "./Features";

describe("Features", () => {
  it("renders the component", () => {
    render(<Features />);
    expect(screen.getByText("Why Choose SyntaxSentinels?")).toBeInTheDocument();
  });

  it("renders all feature titles", () => {
    render(<Features />);
    expect(screen.getByText("Comprehensive Detection")).toBeInTheDocument();
    expect(screen.getByText("Batch Processing")).toBeInTheDocument();
    expect(screen.getByText("Detailed Reports")).toBeInTheDocument();
  });

  it("renders all feature descriptions", () => {
    render(<Features />);
    expect(screen.getByText("Advanced algorithms detect similarities across multiple languages and document formats")).toBeInTheDocument();
    expect(screen.getByText("Analyze multiple submissions simultaneously for efficient grading and evaluation")).toBeInTheDocument();
    expect(screen.getByText("Get comprehensive originality reports with source citations and similarity percentages")).toBeInTheDocument();
  });
});