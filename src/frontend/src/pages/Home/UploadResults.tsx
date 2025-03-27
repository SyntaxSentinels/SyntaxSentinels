import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Typography, Form, message } from "antd";
import JSZip from "jszip";
import UploadBox from "@/components/UploadBox";
import "./UploadResults.css";

const { Title, Paragraph } = Typography;

const UploadResults: React.FC = () => {
  const navigate = useNavigate();
  const [resultsFile, setResultsFile] = useState<File | null>(null);
  const [jsonSimilarityData, setJsonSimilarityData] = useState<any>(null);
  const [jsonFileContents, setJsonFileContents] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Drag Event Handlers
  useEffect(() => {
    const handleDragEnter = () => setIsDragging(true);
    const handleDragOver = (event: DragEvent) => {
      event.preventDefault(); // Allow drop
    };
    const handleDragLeave = (event: DragEvent) => {
      if (event.relatedTarget === null) setIsDragging(false);
    };
    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(false);

      if (event.dataTransfer?.files.length) {
        const file = event.dataTransfer.files[0];
        handleResultsFileUpload(file);
      }
    };

    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("drop", handleDrop);

    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("drop", handleDrop);
    };
  }, []);

  const handleResultsFileUpload = async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      message.error("Only ZIP files are allowed.");
      return;
    }

    setResultsFile(file);
    try {
      const zip = new JSZip();
      const zipContents = await zip.loadAsync(file);
      const jsonFiles = Object.keys(zipContents.files).filter((name) =>
        name.endsWith(".json")
      );

      if (jsonFiles.length === 0) {
        message.error("No JSON file found in the ZIP.");
        setResultsFile(null);
        return;
      }
      
      if (!jsonFiles.includes("similarity_scores.json") || !jsonFiles.includes("file_contents.json")) {
        message.error("Invalid ZIP file or corrupt JSON.");
        setResultsFile(null);
        return;
      }

      // Extract and validate JSON file
      const jsonFileSimilarity = await zipContents.files["similarity_scores.json"].async("text");
      const parsedSimilarityJson = JSON.parse(jsonFileSimilarity);
      const jsonFileContents = await zipContents.files["file_contents.json"].async("text");
      const parsedContentsJson = JSON.parse(jsonFileContents);

      setJsonSimilarityData(parsedSimilarityJson);
      setJsonFileContents(parsedContentsJson);

      message.success("Results file uploaded successfully.");
      // save into local storage
      localStorage.setItem("resultsDataSimilarity", JSON.stringify(parsedSimilarityJson));
      localStorage.setItem("resultsDataContents", JSON.stringify(parsedContentsJson));
    } catch (error) {
      console.error("Error reading ZIP file:", error);
      message.error("Invalid ZIP file or corrupt JSON.");
      setResultsFile(null);
    }
  };

  const handleResultsClick = () => {
    if (!jsonSimilarityData || !jsonFileContents) {
      message.warning("Please upload a valid results ZIP file first.");
      return;
    }

    navigate("/results", { state: { jsonSimilarityData, jsonFileContents } });
  };

  return (
    <>
      {/* Browser-wide Drop Overlay */}
      {isDragging && (
        <div className="drop-overlay">
          <p className="drop-message">Drop your ZIP file here</p>
        </div>
      )}

      <div className="upload-results-container">
        <div className="upload-results-card">
          <Title level={2} className="upload-results-title">
            View Results
          </Title>
          <Paragraph className="upload-results-description">
            Upload your results ZIP file to view the analysis.
          </Paragraph>

          <UploadBox
            onFileListChange={handleResultsFileUpload}
            mode="results" clearFiles={undefined} setClearFiles={undefined}          />

          <Form layout="vertical" className="upload-results-form">
            <Button
              type="primary"
              block
              size="large"
              onClick={handleResultsClick}
              className="upload-results-button"
            >
              View Results
            </Button>
          </Form>
        </div>
      </div>
    </>
  );
};

export default UploadResults;
