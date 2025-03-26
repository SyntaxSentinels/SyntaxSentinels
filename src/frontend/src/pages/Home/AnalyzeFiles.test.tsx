import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import '@testing-library/jest-dom';
import { BrowserRouter as Router } from "react-router-dom";
import AnalyzeFiles from "./AnalyzeFiles";
import { uploadFiles } from "@/services/ssApi";
import { message } from "antd";
import JSZip from "jszip";

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
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
  
// Mock the uploadFiles function
jest.mock("@/services/ssApi", () => ({
  uploadFiles: jest.fn(),
}));

// Mock the message module from antd
jest.mock("antd", () => {
  const originalModule = jest.requireActual("antd");
  return {
    ...originalModule,
    message: {
      success: jest.fn(),
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
  });

  it("renders the component", () => {
    renderWithRouter(<AnalyzeFiles />);
    expect(screen.getByText("Analyze a Dataset")).toBeInTheDocument();
    expect(screen.getByText("Upload a dataset to analyze for potential code plagiarism. Use a ZIP file containing your project files.")).toBeInTheDocument();
  });

  it("displays an alert when no file is uploaded", () => {
    renderWithRouter(<AnalyzeFiles />);
    window.alert = jest.fn();
    fireEvent.click(screen.getByText("Analyze Dataset"));
    expect(window.alert).toHaveBeenCalledWith("Please upload a dataset file first.");
  });

  it("displays an alert when no analysis name is provided", () => {
    renderWithRouter(<AnalyzeFiles />);
    window.alert = jest.fn();
    const file = new File(["dummy content"], "example.zip", { type: "application/zip" });
    fireEvent.change(screen.getByLabelText("Browse Files"), { target: { files: [file] } });
    fireEvent.click(screen.getByText("Analyze Dataset"));
    expect(window.alert).toHaveBeenCalledWith("Please enter a name for this analysis.");
  });

  it("calls uploadFiles and displays success message when form is submitted", async () => {
    renderWithRouter(<AnalyzeFiles />);
    const file = new File(["dummy content"], "example.zip", { type: "application/zip" });
    fireEvent.change(screen.getByLabelText("Browse Files"), { target: { files: [file] } });
    fireEvent.change(screen.getByPlaceholderText("Enter a name for this analysis"), { target: { value: "Test Analysis" } });
    fireEvent.click(screen.getByText("Analyze Dataset"));
    expect(uploadFiles).toHaveBeenCalledWith([file], "Test Analysis");
    expect(message.success).toHaveBeenCalledWith("Analysis started successfully. You'll receive an email with the results once it's done!");
  });

  it("handles file drop event", async () => {
    const mockLoadAsync = jest.fn().mockResolvedValue({
      files: {
        "example.json": { async: jest.fn().mockResolvedValue(JSON.stringify({ key: "value" })) },
      },
    });
    (JSZip as unknown as jest.Mock).mockImplementation(() => ({
      loadAsync: mockLoadAsync,
    }));

    renderWithRouter(<AnalyzeFiles />);

    const file = new File(["dummy content"], "example.zip", { type: "application/zip" });

    // Create a mock DataTransfer object
    const dataTransfer = {
      files: [file],
      items: [{
        kind: 'file',
        type: file.type,
        getAsFile: () => file,
      }],
      types: ['Files'],
    };

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: dataTransfer,
    };

    await act(async () => {
      fireEvent.drop(document, dropEvent);
    });

    expect(screen.getByText("example.zip")).toBeInTheDocument
  });
});