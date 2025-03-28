import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BrowserRouter as Router } from "react-router-dom";
import JobsTable from "./JobsTable";
import { JobInfo } from "@/services/ssApi";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

// Mock window.matchMedia
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
});

describe("JobsTable", () => {
  const mockJobs: JobInfo[] = [
    {
      jobId: "1",
      status: "completed",
      analysisName: "Test Analysis 1",
      createdAt: new Date("2025-03-01T10:00:00Z"),
      updatedAt: new Date("2025-03-02T12:00:00Z"),
      hasResults: true,
    },
    {
      jobId: "2",
      status: "processing",
      analysisName: "Test Analysis 2",
      createdAt: new Date("2025-03-03T14:00:00Z"),
      updatedAt: new Date("2025-03-04T16:00:00Z"),
      hasResults: false,
    },
    {
      jobId: "3",
      status: "failed",
      analysisName: "Test Analysis 3",
      createdAt: new Date("2025-03-05T18:00:00Z"),
      updatedAt: new Date("2025-03-06T20:00:00Z"),
      hasResults: false,
    },
  ];

  it("renders the table with correct columns and data", () => {
    render(
      <Router>
        <JobsTable jobs={mockJobs} loading={false} />
      </Router>
    );

    // Check column headers
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Analysis Name")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Last Updated")).toBeInTheDocument();

    // Check job data
    expect(screen.getByText("Test Analysis 1")).toBeInTheDocument();
    expect(screen.getByText("Test Analysis 2")).toBeInTheDocument();
    expect(screen.getByText("Test Analysis 3")).toBeInTheDocument();
    expect(screen.getByText("COMPLETED")).toBeInTheDocument();
    expect(screen.getByText("PROCESSING")).toBeInTheDocument();
    expect(screen.getByText("FAILED")).toBeInTheDocument();
  });

  it("displays a loading spinner when loading is true", () => {
    render(
      <Router>
        <JobsTable jobs={[]} loading={true} />
      </Router>
    );
  
    // Check for the loading spinner by its class
    const spinner = document.querySelector(".ant-spin");
    expect(spinner).toBeInTheDocument();
  });
  
  it("does not display a loading spinner when loading is false", () => {
    render(
      <Router>
        <JobsTable jobs={[]} loading={false} />
      </Router>
    );
  
    const spinner = document.querySelector(".ant-spin");
    expect(spinner).not.toBeInTheDocument();
  });

  it("disables the 'View Results' button for non-completed jobs", () => {
    render(
      <Router>
        <JobsTable jobs={mockJobs} loading={false} />
      </Router>
    );
  
    const buttons = screen.getAllByRole("button", { name: "View Results" });
  
    // Check the state of each button
    expect(buttons[0]).not.toBeDisabled(); // Completed job
    expect(buttons[1]).toBeDisabled(); // Processing job
    expect(buttons[2]).toBeDisabled(); // Failed job
  });

  it("navigates to the results page when 'View Results' is clicked for a completed job", () => {
    render(
      <Router>
        <JobsTable jobs={mockJobs} loading={false} />
      </Router>
    );
  
    const buttons = screen.getAllByRole("button", { name: "View Results" });
  
    // Click the button for the first job (completed)
    fireEvent.click(buttons[0]);
  
    expect(mockNavigate).toHaveBeenCalledWith("/results?jobId=1");
  });

  it("formats dates correctly in the table", () => {
    render(
      <Router>
        <JobsTable jobs={mockJobs} loading={false} />
      </Router>
    );

    expect(screen.getByText("3/1/2025")).toBeInTheDocument(); // Created date for job 1
    expect(screen.getByText("3/2/2025")).toBeInTheDocument(); // Updated date for job 1
    expect(screen.getByText("3/3/2025")).toBeInTheDocument(); // Created date for job 2
    expect(screen.getByText("3/4/2025")).toBeInTheDocument(); // Updated date for job 2
  });

  it("renders 'Unnamed Analysis' if analysisName is missing", () => {
    const jobsWithUnnamed: JobInfo[] = [
      {
        jobId: "4",
        status: "completed",
        analysisName: "",
        createdAt: new Date("2025-03-07T10:00:00Z"),
        updatedAt: new Date("2025-03-08T12:00:00Z"),
        hasResults: true,
      },
    ];

    render(
      <Router>
        <JobsTable jobs={jobsWithUnnamed} loading={false} />
      </Router>
    );

    expect(screen.getByText("Unnamed Analysis")).toBeInTheDocument();
  });
});