import { api } from "./service/apiService";
import { useAuth0 } from "@auth0/auth0-react";

// Interface for similarity result data
interface SimilarityResult {
  file1: string;
  file2: string;
  similarity_score: number;
  line_comparisons?: {
    file1Line: string;
    file2Line: string;
    similarity: number;
  }[];
}

interface SimilarityData {
  similarity_results: SimilarityResult[];
  file_contents: Record<string, string[]>;
}

// Interface for job information
export interface JobInfo {
  jobId: string;
  status: string;
  analysisName: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  hasResults: boolean;
}

// Interface for job response
interface JobResponse {
  jobId: string;
  status: string;
  resultData?: SimilarityData;
}

export const uploadFiles = async (files: FileList, analysisName: string) => {
  console.log("Uploading files...");
  const formData = new FormData();
  Array.from(files).forEach((file) => {
    formData.append("files", file);
  });

  formData.append("analysisName", analysisName);

  try {
    const response = await api.post("/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error uploading files:", error);
    return null;
  }
};

/**
 * Poll for results using a job ID
 * @param {string} jobId - The job ID to poll for
 * @returns {Promise<JobResponse>} - The job response with status and results if available
 */
export const pollResults = async (jobId: string) => {
  try {
    const response = await api.get(`/results/${jobId}`);
    return response.data;
  } catch (error) {
    console.error("Error polling results:", error);
    throw error;
  }
};

/**
 * Get all jobs for the current user
 * @returns {Promise<Array<JobInfo>>} - Array of job information objects
 */
export const getUserJobs = async () => {
  try {
    const response = await api.get("/results");
    return response.data.jobs;
  } catch (error) {
    console.error("Error getting user jobs:", error);
    throw error;
  }
};

export const compareFiles = async (file1Path: string, file2Path: string) => {
  try {
    const response = await api.post("/compare-files", {
      file1: file1Path,
      file2: file2Path,
    });
    return response.data;
  } catch (error) {
    console.error("Error comparing files:", error);
    throw error;
  }
};
