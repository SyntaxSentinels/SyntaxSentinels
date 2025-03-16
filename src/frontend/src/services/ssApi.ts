import { api } from "./service/apiService";
import { useAuth0 } from "@auth0/auth0-react";

// Interface for similarity result data
interface SimilarityResult {
  file1: string;
  file2: string;
  similarity_score?: number;
  overall_similarity?: number;
  file1_coverage?: number;
  file2_coverage?: number;
  matched_line_count?: number;
  heatmap_data?: {
    file1_line: number;
    file2_line: number;
    similarity: number;
  }[];
  line_comparisons?: {
    file1_line_num: number;
    file2_line_num: number;
    file1_line?: string;
    file2_line?: string;
    similarity: number;
    token_sim?: number;
    embed_sim?: number;
    fingerprint_sim?: number;
  }[];
}

interface SimilarityData {
  similarity_results: SimilarityResult[];
  file_metadata?: Record<string, { line_count: number, file_hash: string }>;
  file_contents?: Record<string, string[]>;
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

export const uploadFiles = async (files: FileList, analysisName: string, modelName: string = "graphbert") => {
  console.log("Uploading files...");
  const formData = new FormData();
  Array.from(files).forEach((file) => {
    formData.append("files", file);
  });

  formData.append("analysisName", analysisName);
  formData.append("modelName", modelName);

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
 * Create a new job and return the job ID
 * @returns {Promise<JobResponse>} - The job response with job ID and status
 */
export const createJob = async () => {
  try {
    const response = await api.post("/results/create");
    return response.data;
  } catch (error) {
    console.error("Error creating job:", error);
    throw error;
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
    const response = await api.get('/results');
    return response.data.jobs;
  } catch (error) {
    console.error("Error getting user jobs:", error);
    throw error;
  }
};

export const compareFiles = async (file1Path: string, file2Path: string, modelName: string = "graphbert") => {
  try {
    const response = await api.post("/compare-files", {
      file1: file1Path,
      file2: file2Path,
      modelName: modelName
    });
    return response.data;
  } catch (error) {
    console.error("Error comparing files:", error);
    throw error;
  }
};
