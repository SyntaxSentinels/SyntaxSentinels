import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Input,
  Typography,
  Form,
  Row,
  Col,
  message,
  Tooltip,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import "./AnalyzeFiles.css";
import UploadBox from "@/components/UploadBox";
import JobsTable from "@/components/JobsTable";
import { uploadFiles, getUserJobs, JobInfo } from "@/services/ssApi";
import { Spin } from "antd";
import { openDB } from "idb";

const { Title, Paragraph } = Typography;

const AnalyzeFiles: React.FC = () => {
  const navigate = useNavigate();
  const [analysisFile, setAnalysisFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analysisName, setAnalysisName] = useState("");
  const [formKey, setFormKey] = useState(0); // Add a key to force re-render
  const [clearFiles, setClearFiles] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  // Fetch jobs on component mount
  useEffect(() => {
    fetchJobs();
  }, []);

  // Function to fetch jobs
  const fetchJobs = async () => {
    try {
      setJobsLoading(true);
      const jobsData = await getUserJobs();
      setJobs(jobsData);
      setJobsLoading(false);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      message.error("Failed to load job history");
      setJobsLoading(false);
    }
  };

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
        handleFileUpload(file);
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

  const handleFileUpload = (file) => {
    setAnalysisFile(file);
  };

  const handleAnalyzeClick = async () => {
    if (!analysisFile || analysisFile.length === 0) {
      message.error("Please upload a dataset file first.");
      return;
    }

    if (!analysisName) {
      message.error("Please enter a name for this analysis.");
      return;
    }

    try {
      setIsLoading(true);
      const response = await uploadFiles(analysisFile, analysisName);

      if (response && response.jobId) {
        const jobId = response.jobId;
        // Store the job ID in localStorage

        // Convert files to JSON and store in IndexedDB
        const filesData = {};
        for (const file of analysisFile) {
          const text = await file.text();
          filesData[file.name] = text;
        }

        const db = await openDB("AnalysisDB", 1, {
          upgrade(db) {
            if (!db.objectStoreNames.contains("jobs")) {
              db.createObjectStore("jobs");
            }
          },
        });

        await db.put("jobs", filesData, jobId);

        // Reset form
        setAnalysisFile(null);
        setAnalysisName("");
        setFormKey((prevKey) => prevKey + 1);
        setClearFiles(true);

        message.success("Analysis started successfully!");

        // Refresh jobs list
        const jobsData = await getUserJobs();
        setJobs(jobsData);
      } else {
        message.error("Failed to start analysis. Please try again.");
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Error uploading files:", error);
      message.error(
        "An error occurred while uploading files. Please try again."
      );
      setIsLoading(false);
    }
  };

  return (
    <>
      {isDragging && (
        <div className="drop-overlay">
          <p className="drop-message">Drop your files here</p>
        </div>
      )}
      <div className="analyze-container">
        <Row gutter={[24, 24]} className="analyze-row">
          <Col xs={24} lg={12} className="analyze-card">
            <Title level={2} className="analyze-title">
              Analyze a Dataset
            </Title>
            <Paragraph className="analyze-description">
              Upload a dataset to analyze for potential code plagiarism. Use a
              ZIP file containing your project files.
            </Paragraph>

            <UploadBox
              onFileListChange={handleFileUpload}
              mode="analyze"
              clearFiles={clearFiles}
              setClearFiles={setClearFiles}
            />

            <Form key={formKey} layout="vertical" className="analyze-form">
              <Form.Item label="Analysis Name" name="analysisName" required>
                <Input
                  placeholder="Enter a name for this analysis"
                  size="large"
                  value={analysisName}
                  onChange={(e) => setAnalysisName(e.target.value)}
                />
              </Form.Item>

              <Button
                type="primary"
                block
                size="large"
                onClick={handleAnalyzeClick}
                className="analyze-button"
                loading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? "Processing..." : "Analyze Dataset"}
              </Button>
            </Form>
          </Col>

          <Col xs={24} lg={12}>
            <div className="jobs-header">
              <Title level={2} className="jobs-title">
                Analysis Jobs
              </Title>
              <Tooltip title="Refresh job list">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={fetchJobs}
                  loading={jobsLoading}
                  className="refresh-button"
                >
                  Refresh
                </Button>
              </Tooltip>
            </div>
            <Paragraph className="jobs-description">
              View your recent analysis jobs and their status. Click on a
              completed job to view results.
            </Paragraph>

            <JobsTable jobs={jobs} loading={jobsLoading} />
          </Col>
        </Row>
      </div>
    </>
  );
};

export default AnalyzeFiles;
