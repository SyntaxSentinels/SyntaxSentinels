import React, { useState, useEffect } from "react";
import { Card } from "@/components/common/card";
import { Button, Spin, message } from "antd";

interface SimilarityResult {
  file1: string;
  file2: string;
  similarity_score: number;
  line_comparisons: {
    file1Line: string;
    file2Line: string;
    similarity: number;
  }[];
}

interface SimilarityData {
  similarity_results: SimilarityResult[];
  file_contents: Record<string, string[]>;
}

interface PlagiarismCompareProps {
  file1Path: string;
  file2Path: string;
  onClose: () => void;
  similarityData: SimilarityData;
}

interface LineComparison {
  file1Line: string;
  file2Line: string;
  similarity: number;
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

        // Find the similarity result for this file pair
        const result = similarityData.similarity_results.find(
          (r: SimilarityResult) =>
            (r.file1 === file1Path && r.file2 === file2Path) ||
            (r.file1 === file2Path && r.file2 === file1Path)
        );

        if (!result) {
          message.error("Could not find similarity data for these files");
          return;
        }

        // Get file contents
        const content1 = similarityData.file_contents[file1Path] || [];
        const content2 = similarityData.file_contents[file2Path] || [];

        setFile1Content(content1);
        setFile2Content(content2);

        // Process the line comparisons
        const comparisons = (result.line_comparisons || []).map(
          (comparison) => ({
            file1Line: comparison.file1Line,
            file2Line: comparison.file2Line,
            similarity: comparison.similarity,
            isPlagiarized: comparison.similarity >= threshold,
          })
        );

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
    isPlagiarized: boolean
  ) => {
    return (
      <div
        key={lineNumber}
        className={`py-1 pl-2 font-mono text-sm flex ${
          isPlagiarized ? "bg-red-100 border-l-4 border-red-500" : ""
        }`}
      >
        <span className="w-8 text-gray-500 select-none">{lineNumber}</span>
        <span className="flex-1 whitespace-pre">{line}</span>
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
                    (comp) => comp.file1Line === line
                  );
                  return renderCodeLine(
                    line,
                    index + 1,
                    comparison?.isPlagiarized || false
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
                    (comp) => comp.file2Line === line
                  );
                  return renderCodeLine(
                    line,
                    index + 1,
                    comparison?.isPlagiarized || false
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
