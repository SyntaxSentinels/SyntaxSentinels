import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import '@testing-library/jest-dom';
import UploadBox from "./UploadBox";

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

describe("UploadBox", () => {
  it("renders the component", () => {
    render(<UploadBox onFileListChange={jest.fn()} mode="analyze" clearFiles={false} setClearFiles={jest.fn()} />);
    expect(screen.getByText("Click or drag file to this area to upload")).toBeInTheDocument();
  });

  it("uploads a valid file", () => {
    const onFileListChange = jest.fn();
    render(<UploadBox onFileListChange={onFileListChange} mode="analyze" clearFiles={false} setClearFiles={jest.fn()} />);

    const input = screen.getByLabelText("Browse Files");
    const file = new File(["dummy content"], "example.zip", { type: "application/zip" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFileListChange).toHaveBeenCalledWith([file]);
    expect(screen.getByText("example.zip")).toBeInTheDocument();
  });

  it("removes a file", () => {
    const onFileListChange = jest.fn();
    render(<UploadBox onFileListChange={onFileListChange} mode="analyze" clearFiles={false} setClearFiles={jest.fn()} />);

    const input = screen.getByLabelText("Browse Files");
    const file = new File(["dummy content"], "example.zip", { type: "application/zip" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("example.zip")).toBeInTheDocument();

    const removeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(removeButton);

    expect(onFileListChange).toHaveBeenCalledWith([]);
    expect(screen.queryByText("example.zip")).not.toBeInTheDocument();
  });

  it("clears the file list when clearFiles is true", () => {
    const onFileListChange = jest.fn();
    const setClearFiles = jest.fn();
    const { rerender } = render(<UploadBox onFileListChange={onFileListChange} mode="analyze" clearFiles={false} setClearFiles={setClearFiles} />);

    const input = screen.getByLabelText("Browse Files");
    const file = new File(["dummy content"], "example.zip", { type: "application/zip" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("example.zip")).toBeInTheDocument();

    rerender(<UploadBox onFileListChange={onFileListChange} mode="analyze" clearFiles={true} setClearFiles={setClearFiles} />);

    expect(onFileListChange).toHaveBeenCalledWith([]);
    expect(screen.queryByText("example.zip")).not.toBeInTheDocument();
    expect(setClearFiles).toHaveBeenCalledWith(false);
  });
});