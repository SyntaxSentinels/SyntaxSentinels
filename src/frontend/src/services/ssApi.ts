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
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error("An error occurred while uploading files. Please try again.");
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

/**
 * Delete a job
 * @param {string} jobId - The job ID to delete
 * @returns {Promise<void>}
 */
export const deleteJob = async (jobId: string) => {
  try {
    await api.delete(`/results/${jobId}`);
  } catch (error) {
    console.error("Error deleting job:", error);
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

export const compareFilesApi = async ({
  file1Content,
  file2Content,
  file1Name,
  file2Name,
  k, // Now optional
  w, // Now optional
}: {
  file1Content: string;
  file2Content: string;
  file1Name?: string; // Keep optional if they are
  file2Name?: string; // Keep optional if they are
  k?: number; // Mark k as optional
  w?: number; // Mark w as optional
}): Promise<DetailedComparisonResult> => {
  try {
    // Construct payload, only including k/w if provided
    const payload: any = {
      file1Content,
      file2Content,
      // Only include names if they have a value (optional chaining might be better if applicable)
      ...(file1Name && { file1Name }),
      ...(file2Name && { file2Name }),
      // Only include k/w if they have a value
      ...(k !== undefined && { k }),
      ...(w !== undefined && { w }),
    };

    // Replace 'apiClient.post' with your actual API call method
    const response = await api.post("/similarity/compare", payload);
    return response.data;
  } catch (error) {
    console.error(
      "Error comparing files:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.message || "Failed to compare files."
    );
  }
};

export const getFileContentsFromS3 = async (jobId: string): Promise<Record<string, string>> => {
  try {
    const response = await api.get(`/files/contents/${jobId}`);
    return response.data;
  } catch (error) {
    console.error("Error getting file contents from S3:", error);
    throw new Error("Failed to get file contents from S3");
  }
};

interface DetailedComparisonResult {
  file1: string;
  file2: string;
  similarity_score: number;
  matches: MatchCluster[]; // Matches from the API (ss, ts)
}
interface Span {
  sl: number;
  sc: number;
  el: number;
  ec: number;
}

// Interface for the matches structure coming from the API (assuming ss/ts)
interface MatchCluster {
  ss: Span[];
  ts: Span[];
}
