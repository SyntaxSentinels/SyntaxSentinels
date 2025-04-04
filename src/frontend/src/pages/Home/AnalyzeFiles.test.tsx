import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BrowserRouter as Router } from "react-router-dom";
import AnalyzeFiles from "./AnalyzeFiles";
import { uploadFiles, getUserJobs } from "@/services/ssApi";
import { message } from "antd";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

// Mock the uploadFiles and getUserJobs functions
jest.mock("@/services/ssApi", () => ({
  uploadFiles: jest.fn(),
  getUserJobs: jest.fn(),
}));

// Mock the message module from antd
jest.mock("antd", () => {
  const originalModule = jest.requireActual("antd");
  return {
    ...originalModule,
    message: {
      success: jest.fn(),
      error: jest.fn(),
    },
  };
});

// Mock JSZip
jest.mock("jszip", () => {
  return jest.fn().mockImplementation(() => ({
    loadAsync: jest.fn(),
  }));
});

describe("AnalyzeFiles", () => {
  const renderWithRouter = (ui: React.ReactElement) => {
    return render(<Router>{ui}</Router>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getUserJobs as jest.Mock).mockResolvedValue([]);
  });

  it("renders the component", async () => {
    (getUserJobs as jest.Mock).mockResolvedValue([]);
    
    await act(async () => {
      renderWithRouter(<AnalyzeFiles />);
    });

    expect(screen.getByText("Analyze a Dataset")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Upload a dataset to analyze for potential code plagiarism. Use a ZIP file containing your project files."
      )
    ).toBeInTheDocument();
  });

  it("displays an error message when no file is uploaded", async () => {
    (getUserJobs as jest.Mock).mockResolvedValue([]);
    
    await act(async () => {
      renderWithRouter(<AnalyzeFiles />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Analyze Dataset"));
    });
    
    expect(message.error).toHaveBeenCalledWith(
      "Please upload a dataset file first."
    );
  });

  it("displays an error message when no analysis name is provided", async () => {
    (getUserJobs as jest.Mock).mockResolvedValue([]);
    
    await act(async () => {
      renderWithRouter(<AnalyzeFiles />);
    });

    const file = new File(["dummy content"], "example.zip", {
      type: "application/zip",
    });
    
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Browse Files"), {
        target: { files: [file] },
      });
      fireEvent.click(screen.getByText("Analyze Dataset"));
    });
    
    expect(message.error).toHaveBeenCalledWith(
      "Please enter a name for this analysis."
    );
  });

  /*
  it("calls uploadFiles and displays success message when form is submitted", async () => {
    (uploadFiles as jest.Mock).mockResolvedValue({ jobId: "12345" });
    (getUserJobs as jest.Mock).mockResolvedValue([]);
  
    const file = new File(["dummy content"], "example.zip", {
      type: "application/zip",
    });
  
    // Mock the text() method for the File object
    Object.defineProperty(file, "text", {
      value: jest.fn().mockResolvedValue("dummy content"),
    });
  
    await act(async () => {
      renderWithRouter(<AnalyzeFiles />);
    });
  
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Browse Files"), {
        target: { files: [file] },
      });
      fireEvent.change(
        screen.getByPlaceholderText("Enter a name for this analysis"),
        { target: { value: "Test Analysis" } }
      );
      fireEvent.click(screen.getByText("Analyze Dataset"));
    });
  
    expect(uploadFiles).toHaveBeenCalledWith([file], "Test Analysis");
    expect(message.success).toHaveBeenCalledWith(
      "Analysis started successfully!"
    );
  });
  */

  it("handles file drop event", async () => {
    (getUserJobs as jest.Mock).mockResolvedValue([]);
    
    await act(async () => {
      renderWithRouter(<AnalyzeFiles />);
    });

    const file = new File(["dummy content"], "example.zip", {
      type: "application/zip",
    });

    // Create a mock DataTransfer object
    const dataTransfer = {
      files: [file],
      items: [
        {
          kind: "file",
          type: file.type,
          getAsFile: () => file,
        },
      ],
      types: ["Files"],
    };

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: dataTransfer,
    };

    await act(async () => {
      fireEvent.drop(document, dropEvent);
    });

    expect(screen.getByText("example.zip")).toBeInTheDocument();
  });

  describe("Job fetching and display", () => {
    const mockJobs = [
      { 
        jobId: "1", 
        name: "Test Job 1", 
        status: "Completed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      { 
        jobId: "2", 
        name: "Test Job 2", 
        status: "In Progress",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    it("should handle empty jobs list", async () => {
      (getUserJobs as jest.Mock).mockResolvedValueOnce([]);

      renderWithRouter(<AnalyzeFiles />);

      await waitFor(() => {
        // Using queryAll and checking length
        const emptyTexts = screen.queryAllByText(/no data/i);
        expect(emptyTexts.length).toBeGreaterThan(0);
      });
    });
  });

  it("displays an error message if fetching jobs fails", async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    (getUserJobs as jest.Mock).mockRejectedValue(new Error("Failed to fetch"));
  
    await act(async () => {
      renderWithRouter(<AnalyzeFiles />);
    });
  
    expect(message.error).toHaveBeenCalledWith("Failed to load job history");
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching jobs:", expect.any(Error));
    
    consoleErrorSpy.mockRestore();
});
});