import React, { useState, useEffect } from "react";
import { Card } from "@/components/common/card";
import { Button, Spin, message } from "antd";

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
  line_comparisons: {
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
  file_metadata?: Record<string, { line_count: number; file_hash: string }>;
  file_contents?: Record<string, string[]>;
}

interface PlagiarismCompareProps {
  file1Path: string;
  file2Path: string;
  onClose: () => void;
  similarityData: SimilarityData;
}

interface LineComparison {
  file1_line: string;
  file2_line: string;
  file1_line_num?: number;
  file2_line_num?: number;
  similarity: number;
  token_sim?: number;
  embed_sim?: number;
  fingerprint_sim?: number;
  isPlagiarized: boolean;
}

const PlagiarismCompare: React.FC<PlagiarismCompareProps> = ({
  file1Path,
  file2Path,
  onClose,
  similarityData,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [file1Content, setFile1Content] = useState<string[]>([]);
  const [file2Content, setFile2Content] = useState<string[]>([]);
  const [lineComparisons, setLineComparisons] = useState<LineComparison[]>([]);
  const [threshold, setThreshold] = useState<number>(0.8); // Default threshold for flagging lines

  useEffect(() => {
    const processData = () => {
      try {
        setLoading(true);

        // Debug: Log the input data
        console.log("PlagiarismCompare - Input data:", {
          file1Path,
          file2Path,
          similarityData,
        });

        // Find the similarity result for this file pair
        const result = similarityData.similarity_results.find(
          (r: SimilarityResult) =>
            (r.file1 === file1Path && r.file2 === file2Path) ||
            (r.file1 === file2Path && r.file2 === file1Path)
        );

        if (!result) {
          console.error("Could not find similarity data for these files:", {
            file1Path,
            file2Path,
            availableResults: similarityData.similarity_results.map((r) => ({
              file1: r.file1,
              file2: r.file2,
            })),
          });
          message.error("Could not find similarity data for these files");
          return;
        }

        // Debug: Log the found result
        console.log("Found similarity result:", result);

        // Get file contents if available
        console.log("File content availability:", {
          hasFileContents: !!similarityData.file_contents,
          hasFileMetadata: !!similarityData.file_metadata,
          file1Path,
          file2Path,
        });

        if (similarityData.file_contents) {
          const content1 = similarityData.file_contents[file1Path] || [];
          const content2 = similarityData.file_contents[file2Path] || [];
          console.log("Using file contents:", {
            file1ContentLength: content1.length,
            file2ContentLength: content2.length,
          });
          setFile1Content(content1);
          setFile2Content(content2);
        } else if (similarityData.file_metadata) {
          // Create empty arrays with the correct length based on metadata
          const file1LineCount =
            similarityData.file_metadata[file1Path]?.line_count || 0;
          const file2LineCount =
            similarityData.file_metadata[file2Path]?.line_count || 0;
          console.log("Using file metadata for line counts:", {
            file1LineCount,
            file2LineCount,
            file1Metadata: similarityData.file_metadata[file1Path],
            file2Metadata: similarityData.file_metadata[file2Path],
          });
          setFile1Content(Array(file1LineCount).fill(""));
          setFile2Content(Array(file2LineCount).fill(""));
        } else {
          console.warn("No file contents or metadata available");
          // Fallback to empty arrays
          setFile1Content([]);
          setFile2Content([]);
        }

        // Process the line comparisons
        console.log("Processing line comparisons:", {
          hasLineComparisons: !!result.line_comparisons,
          lineComparisonsCount: result.line_comparisons?.length || 0,
        });

        if (result.line_comparisons && result.line_comparisons.length > 0) {
          console.log("Sample line comparison:", result.line_comparisons[0]);
        }

        const comparisons = (result.line_comparisons || []).map(
          (comparison) => ({
            file1_line: comparison.file1_line || "",
            file2_line: comparison.file2_line || "",
            file1_line_num: comparison.file1_line_num,
            file2_line_num: comparison.file2_line_num,
            similarity: comparison.similarity,
            token_sim: comparison.token_sim,
            embed_sim: comparison.embed_sim,
            fingerprint_sim: comparison.fingerprint_sim,
            isPlagiarized: comparison.similarity >= threshold,
          })
        );

        console.log("Processed comparisons:", {
          count: comparisons.length,
          sample: comparisons.length > 0 ? comparisons[0] : null,
        });

        setLineComparisons(comparisons);
      } catch (error) {
        console.error("Error fetching file contents:", error);
        message.error("Failed to load file comparison");
      } finally {
        setLoading(false);
      }
    };

    processData();
  }, [file1Path, file2Path, threshold]);

  // Function to render a code line with highlighting
  const renderCodeLine = (
    line: string,
    lineNumber: number,
    isPlagiarized: boolean,
    comparison?: {
      similarity: number;
      token_sim?: number;
      embed_sim?: number;
      fingerprint_sim?: number;
    }
  ) => {
    // Calculate the color intensity based on similarity score
    const getColorIntensity = (score) => {
      if (!score) return 0;
      return Math.min(100, Math.max(0, Math.floor(score * 100)));
    };

    const bgColor = isPlagiarized
      ? `bg-red-${getColorIntensity(comparison?.similarity || 0)}`
      : "";

    return (
      <div
        key={lineNumber}
        className={`py-1 pl-2 font-mono text-sm flex ${
          isPlagiarized ? `${bgColor} border-l-4 border-red-500` : ""
        }`}
        title={
          comparison
            ? `Similarity: ${(comparison.similarity * 100).toFixed(1)}%
Token Similarity: ${
                comparison.token_sim
                  ? (comparison.token_sim * 100).toFixed(1) + "%"
                  : "N/A"
              }
Embedding Similarity: ${
                comparison.embed_sim
                  ? (comparison.embed_sim * 100).toFixed(1) + "%"
                  : "N/A"
              }
Fingerprint Similarity: ${
                comparison.fingerprint_sim
                  ? (comparison.fingerprint_sim * 100).toFixed(1) + "%"
                  : "N/A"
              }`
            : ""
        }
      >
        <span className="w-8 text-gray-500 select-none">{lineNumber}</span>
        <span className="flex-1 whitespace-pre">{line}</span>
        {isPlagiarized && (
          <span className="text-xs text-red-600 font-semibold pr-2">
            {(comparison?.similarity * 100).toFixed(1)}%
          </span>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full max-w mx-auto my-8 shadow-lg">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Code Comparison</h2>
          <Button onClick={onClose}>Close</Button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Lines highlighted in red are flagged as potentially plagiarized
          content.
        </p>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Spin size="large" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                File 1:{" "}
                <span className="font-normal text-gray-600">{file1Path}</span>
              </h3>
              <div className="border rounded-md overflow-auto max-h-[600px] bg-gray-50">
                {file1Content.map((line, index) => {
                  const comparison = lineComparisons.find(
                    (comp) =>
                      comp.file1_line_num === index || comp.file1_line === line
                  );

                  // Debug first few lines to see what's happening
                  if (index < 3) {
                    console.log(`File1 line ${index}:`, {
                      line,
                      foundComparison: !!comparison,
                      comparisonDetails: comparison,
                      matchedByLineNum: comparison?.file1_line_num === index,
                      matchedByContent: comparison?.file1_line === line,
                    });
                  }

                  return renderCodeLine(
                    line,
                    index + 1,
                    comparison?.isPlagiarized || false,
                    comparison
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">
                File 2:{" "}
                <span className="font-normal text-gray-600">{file2Path}</span>
              </h3>
              <div className="border rounded-md overflow-auto max-h-[600px] bg-gray-50">
                {file2Content.map((line, index) => {
                  const comparison = lineComparisons.find(
                    (comp) =>
                      comp.file2_line_num === index || comp.file2_line === line
                  );

                  // Debug first few lines to see what's happening
                  if (index < 3) {
                    console.log(`File2 line ${index}:`, {
                      line,
                      foundComparison: !!comparison,
                      comparisonDetails: comparison,
                      matchedByLineNum: comparison?.file2_line_num === index,
                      matchedByContent: comparison?.file2_line === line,
                    });
                  }

                  return renderCodeLine(
                    line,
                    index + 1,
                    comparison?.isPlagiarized || false,
                    comparison
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default PlagiarismCompare;
