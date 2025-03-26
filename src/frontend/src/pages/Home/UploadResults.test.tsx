import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import '@testing-library/jest-dom';
import { BrowserRouter as Router } from "react-router-dom";
import UploadResults from "./UploadResults";
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

// Mock the message module from antd
jest.mock("antd", () => {
  const originalModule = jest.requireActual("antd");
  return {
    ...originalModule,
    message: {
      success: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
    },
  };
});

// Mock JSZip
jest.mock("jszip", () => {
  return jest.fn().mockImplementation(() => ({
    loadAsync: jest.fn(),
  }));
});

describe("UploadResults", () => {
  const renderWithRouter = (ui: React.ReactElement) => {
    return render(<Router>{ui}</Router>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the component", () => {
    renderWithRouter(<UploadResults />);
    expect(screen.getByRole('heading', { name: /View Results/i })).toBeInTheDocument();
    expect(screen.getByText("Upload your results ZIP file to view the analysis.")).toBeInTheDocument();
  });

  it("displays an error message when a non-ZIP file is uploaded", async () => {
    renderWithRouter(<UploadResults />);
    const file = new File(["dummy content"], "example.txt", { type: "text/plain" });
    await act(async () => {
        fireEvent.change(screen.getByLabelText("Browse Files"), { target: { files: [file] } });
      });
    expect(message.error).toHaveBeenCalledWith("Invalid file type. Only .zip files are allowed.");
  });

  it("displays an error message when no JSON file is found in the ZIP", async () => {
    const mockLoadAsync = jest.fn().mockResolvedValue({
      files: {
        "example.txt": { async: jest.fn().mockResolvedValue("dummy content") },
      },
    });
    (JSZip as unknown as jest.Mock).mockImplementation(() => ({
      loadAsync: mockLoadAsync,
    }));

    renderWithRouter(<UploadResults />);
    const file = new File(["dummy content"], "example.zip", { type: "application/zip" });
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Browse Files"), { target: { files: [file] } });
      await mockLoadAsync();
    });
    expect(message.error).toHaveBeenCalledWith("No JSON file found in the ZIP.");
  });

  it("displays a success message when a valid ZIP file is uploaded", async () => {
    const mockLoadAsync = jest.fn().mockResolvedValue({
      files: {
        "example.json": { async: jest.fn().mockResolvedValue(JSON.stringify({ key: "value" })) },
      },
    });
    (JSZip as unknown as jest.Mock).mockImplementation(() => ({
      loadAsync: mockLoadAsync,
    }));

    renderWithRouter(<UploadResults />);
    const file = new File(["dummy content"], "example.zip", { type: "application/zip" });
    await act(async () => {
        fireEvent.change(screen.getByLabelText("Browse Files"), { target: { files: [file] } });
        await mockLoadAsync();
      });
    expect(message.success).toHaveBeenCalledWith("File uploaded successfully: example.zip");
  });

  it("displays a warning message when trying to view results without uploading a file", () => {
    renderWithRouter(<UploadResults />);
    fireEvent.click(screen.getByRole('button', { name: /View Results/i }));
    expect(message.warning).toHaveBeenCalledWith("Please upload a valid results ZIP file first.");
  });

  it("handles errors during ZIP file processing", async () => {
    const mockLoadAsync = jest.fn().mockRejectedValue(new Error("Invalid ZIP file"));
    (JSZip as unknown as jest.Mock).mockImplementation(() => ({
      loadAsync: mockLoadAsync,
    }));

    // Mock console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    renderWithRouter(<UploadResults />);
    const file = new File(["dummy content"], "example.zip", { type: "application/zip" });
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Browse Files"), { target: { files: [file] } });
      await mockLoadAsync().catch(() => {}); // Catch the error to prevent unhandled promise rejection
    });

    expect(console.error).toHaveBeenCalledWith("Error reading ZIP file:", expect.any(Error));
    expect(message.error).toHaveBeenCalledWith("Invalid ZIP file or corrupt JSON.");
    expect(screen.queryByLabelText("Browse Files")).toHaveValue("");

    // Restore console.error
    consoleErrorSpy.mockRestore();
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

    renderWithRouter(<UploadResults />);

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

    expect(message.success).toHaveBeenCalledWith("Results file uploaded successfully.");
  });
});