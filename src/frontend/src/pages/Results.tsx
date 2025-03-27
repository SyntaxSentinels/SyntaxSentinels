import { useNavigate, useLocation } from "react-router-dom";
import { pollResults } from "@/services/ssApi";
import { ReloadOutlined } from "@ant-design/icons";
import "./Results.css";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/common/table";
import { Card } from "@/components/common/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/common/dialog";
import { ChartContainer, ChartTooltip } from "@/components/common/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useEffect, useState, useMemo } from "react";
import { Button, Pagination, Spin, Slider, message, Modal } from "antd";
import { ArrowLeftOutlined, EyeOutlined } from "@ant-design/icons";
import CodeSimilarityViewer from "@/components/CodeSimilarityViewer";
import PlagiarismCompare from "@/components/PlagiarismCompare";

// Interfaces for our data structures
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

interface SimilarityStats {
  highestSimilarity: number;
  averageSimilarity: number;
  medianSimilarity: number;
  totalSubmissions: number;
}

function numberOfFiles(x) {
  return (1 + (1 + 8 * x) ** 0.5) / 2;
}

// Helper function to calculate median
const calculateMedian = (values: number[]) => {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 !== 0
    ? values[mid]
    : (values[mid - 1] + values[mid]) / 2;
};

// Generate distribution for the chart
const generateDistribution = (results: SimilarityResult[]) => {
  const bins = Array(10).fill(0);
  results.forEach((result) => {
    const index = Math.min(Math.floor((result.similarity_score * 100) / 10), 9);
    bins[index]++;
  });

  return bins.map((count, i) => ({
    similarity: `${i * 10}-${i * 10 + 9}%`,
    count,
  }));
};


function compareSpan(left, right) {
  let diff = left.startLine - right.startLine;
  if (diff !== 0) { return diff; }
  diff = left.startColumn - right.startColumn;
  if (diff !== 0) { return diff; }
  diff = left.endLine - right.endLine;
  if (diff !== 0) { return diff; }
  diff = left.endColumn - right.endColumn;
  if (diff !== 0) { return diff; }
  return 0;
}

function mergeSpans(one, other) {
  let startLine, startColumn, endLine, endColumn;
  if(one.startLine < other.startLine) {
    startLine = one.startLine;
    startColumn = one.startColumn;
  } else if (one.startLine > other.startLine) {
    startLine = other.startLine;
    startColumn = other.startColumn;
  } else {
    startLine = one.startLine;
    startColumn = Math.min(one.startColumn, other.startColumn);
  }
  if(one.endLine > other.endLine) {
    endLine = one.endLine;
    endColumn = one.endColumn;
  } else if (one.endLine < other.endLine) {
    endLine = other.endLine;
    endColumn = other.endColumn;
  } else {
    endLine = one.endLine;
    endColumn = Math.max(one.endColumn, other.endColumn);
  }
  return {"startLine": startLine, "startColumn": startColumn, "endLine": endLine, "endColumn": endColumn};
}

function spansOverlap(span1, span2): boolean {
  const [left, right] = [span1, span2].sort(compareSpan);
  if (left.endLine < right.startLine) {
    return false;
  } else if (left.endLine === right.startLine) {
    return right.startColumn < left.endColumn;
  } else {
    return true;
  }
}


function mergeOverlappingSpans(matches: SimilarityResult['matches']): SimilarityResult['matches'] {
  // Helper function to merge spans in a list
  function mergeSpansList(spans) {
    // Sort spans by startLine and startColumn
    spans.sort(compareSpan);

    const mergedSpans = [];
    let currentSpan = spans[0]; // Start with the first span

    for (let i = 1; i < spans.length; i++) {
      const nextSpan = spans[i];
      // If the current span overlaps with the next one, merge them
      if (spansOverlap(currentSpan, nextSpan)) {
        currentSpan = mergeSpans(currentSpan, nextSpan);
      } else {
        // No overlap, push the current span and move to the next one
        mergedSpans.push(currentSpan);
        currentSpan = nextSpan;
      }
    }

    // Push the last span after the loop
    mergedSpans.push(currentSpan);
    return mergedSpans;
  }

  // Function to check if two matches overlap
  function matchesOverlap(match1, match2) {
    // Check if there is any overlap in sourceSpans
    const sourceOverlap = match1.sourceSpans.some(span1 =>
      match2.sourceSpans.some(span2 => spansOverlap(span1, span2))
    );
    // Check if there is any overlap in targetSpans
    const targetOverlap = match1.targetSpans.some(span1 =>
      match2.targetSpans.some(span2 => spansOverlap(span1, span2))
    );
    return sourceOverlap || targetOverlap;
  }

  // Start with an empty list for merged matches
  let mergedMatches = [];

  // Loop through all matches and attempt to merge them
  for (let i = 0; i < matches.length; i++) {
    let currentMatch = matches[i];
    let merged = false;

    // Try to merge the current match with any match in the mergedMatches list
    for (let j = 0; j < mergedMatches.length; j++) {
      const existingMatch = mergedMatches[j];

      // If the current match overlaps with an existing match, merge them
      if (matchesOverlap(currentMatch, existingMatch)) {
        existingMatch.sourceSpans = mergeSpansList([...existingMatch.sourceSpans, ...currentMatch.sourceSpans]);
        existingMatch.targetSpans = mergeSpansList([...existingMatch.targetSpans, ...currentMatch.targetSpans]);
        merged = true;
        break;
      }
    }

    // If no merge occurred, add the current match as a new match
    if (!merged) {
      mergedMatches.push({ ...currentMatch });
    }
  }

  return mergedMatches;
}


const Results = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState<SimilarityResult[]>([]);
  const [similarityData, setSimilarityData] = useState<SimilarityData | null>(
    null
  );
  const [stats, setStats] = useState<SimilarityStats>({
    highestSimilarity: 0,
    averageSimilarity: 0,
    medianSimilarity: 0,
    totalSubmissions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [threshold, setThreshold] = useState(50);
  const [filteredResults, setFilteredResults] = useState<SimilarityResult[]>(
    []
  );
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{
    file1: string;
    file2: string;
  } | null>(null);
  const itemsPerPage = 20; // Show only 20 items per page

  const location = useLocation();
  const [jobId, setJobId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Extract job ID from URL query parameters or localStorage
  useEffect(() => {
    setLoading(true);

    // Try to get job ID from URL query parameters
    const params = new URLSearchParams(location.search);
    const jobIdFromUrl = params.get("jobId");

    if (jobIdFromUrl) {
      setJobId(jobIdFromUrl);
    } else {
      // Try to get job ID from localStorage
      const storedJobId = localStorage.getItem("jobId");

      if (!storedJobId) {
        message.error("No job ID found. Please submit code files first.");
        navigate("/");
        return;
      }

      setJobId(storedJobId);
    }
  }, [location, navigate]);

  // Fetch results when job ID is available
  useEffect(() => {
    if (!jobId) return;
    fetchResults();
  }, [jobId]);

  // Function to fetch results
  const fetchResults = async () => {
    if (!jobId) return;

    try {
      setRefreshing(true);
      const response = await pollResults(jobId);

      if (response.status === "completed" && response.resultData) {
        const jsonData = response.resultData;

        // Process the results
        setSimilarityData(jsonData);
        const results = jsonData.similarity_results;

        if (!Array.isArray(results) || results.length === 0) {
          message.error("No data found in the results.");
          setRefreshing(false);
          return;
        }

        const similarityValues = results.map((r) => r.similarity_score * 100);
        const highest = Math.max(...similarityValues);
        const avg = Math.round(
          similarityValues.reduce((acc, val) => acc + val, 0) / results.length
        );
        const median = calculateMedian(similarityValues);

        setResults(
          results.sort((a, b) => b.similarity_score - a.similarity_score)
        );

        // Filter results based on threshold
        setFilteredResults(
          results.sort((a, b) => b.similarity_score - a.similarity_score)
        );

        setStats({
          highestSimilarity: highest,
          averageSimilarity: avg,
          medianSimilarity: median,
          totalSubmissions: results.length,
        });

        setLoading(false);
      } else if (response.status === "failed") {
        message.error("The analysis job failed. Please try again.");
        navigate("/");
      } else {
        // If status is 'pending' or 'processing', show message
        message.info(
          `Job status: ${response.status}. Please refresh to check again.`
        );
        setLoading(false);
      }
      setRefreshing(false);
    } catch (error) {
      console.error("Error fetching results:", error);
      message.error(
        "An error occurred while fetching results. Please try again."
      );
      setRefreshing(false);
      navigate("/");
    }
  };

  // Filter results based on threshold
  useEffect(() => {
    setFilteredResults(
      results.filter((r) => r.similarity_score * 100 >= threshold)
    );
  }, [results, threshold]);

  // Paginate table data
  const displayedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredResults.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredResults, currentPage]);

  // Handle opening the comparison modal
  const handleCompareClick = (file1: string, file2: string) => {
    setSelectedFiles({ file1, file2 });
    setIsCompareModalOpen(true);
  };

  // Handle closing the comparison modal
  const handleCloseCompareModal = () => {
    setIsCompareModalOpen(false);
    setSelectedFiles(null);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto">
        {/* Back Button */}
        <div className="results-header">
          <Button
            type="default"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/")}
          >
            Back
          </Button>

          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={fetchResults}
            loading={refreshing}
            disabled={loading}
          >
            Refresh Results
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Source Code Plagiarism Detection Report
          </h1>
          <p className="text-muted-foreground">
            Analysis results for submitted code files
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center">
            <Spin size="large" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card className="p-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Highest Similarity
                </h3>
                <p className="text-4xl font-bold text-primary">
                  {stats.highestSimilarity.toFixed(3)}%
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Average Similarity
                </h3>
                <p className="text-4xl font-bold">{stats.averageSimilarity}%</p>
                <p className="text-sm text-muted-foreground">
                  Median: {stats.medianSimilarity.toFixed(3)}%
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Total Submissions
                </h3>
                <p className="text-4xl font-bold">
                  {numberOfFiles(stats.totalSubmissions)}
                </p>
              </Card>
            </div>

            {/* Similarity Distribution Chart */}
            <Card className="p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">
                Similarity Distribution (pairs)
              </h2>
              <div className="w-full aspect-[2/1] min-h-[400px]">
                <ChartContainer config={{}}>
                  <BarChart
                    data={generateDistribution(results)}
                    margin={{ top: 20, right: 30, left: 40, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="similarity"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      interval={0}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366F1" maxBarSize={50} />
                  </BarChart>
                </ChartContainer>
              </div>
            </Card>

            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold mb-2">
                Similarity Threshold: {threshold}%
              </h2>
              <Slider
                min={0}
                max={100}
                step={1}
                value={threshold}
                onChange={setThreshold}
                className="w-full"
              />
            </Card>

            {/* Submissions Table with Pagination */}
            <Card className="mb-8">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">
                  Similar Submissions
                </h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File 1</TableHead>
                      <TableHead>File 2</TableHead>
                      <TableHead className="text-right">Similarity</TableHead>
                      <TableHead className="text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedResults.map((result, index) => (
                      <TableRow key={index} onClick={() => setSelectedSubmission(result)} className="cursor-pointer hover:bg-gray-100">
                        <TableCell className="font-medium">{result.file1}</TableCell>
                        <TableCell>{result.file2}</TableCell>
                        <TableCell className="text-right">
                          {(result.similarity_score * 100).toFixed(3)}%
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            type="primary"
                            icon={<EyeOutlined />}
                            onClick={() =>
                              handleCompareClick(result.file1, result.file2)
                            }
                            size="small"
                          >
                            Compare
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Pagination
                  current={currentPage}
                  total={filteredResults.length}
                  pageSize={itemsPerPage}
                  onChange={(page) => setCurrentPage(page)}
                  className="mt-4 text-center"
                />
              </div>
            </Card>

            {/* Full-Screen Modal */}
            <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
            <DialogContent className="max-w-full h-full bg-white p-6">
                <DialogHeader>
                  <DialogTitle>Similarity result</DialogTitle>
                </DialogHeader>
                <div>
                  {selectedSubmission && (
                    <>
                      <CodeSimilarityViewer 
                        fileA={allFileContents[selectedSubmission.file1]}
                        fileB={allFileContents[selectedSubmission.file2]}
                        spanClusters={selectedSubmission.matches}
                      />
                      <div>
                        <p><strong>File 1:</strong> {selectedSubmission.file1}</p>
                        <p><strong>File 2:</strong> {selectedSubmission.file2}</p>
                        <p><strong>Similarity:</strong> {(selectedSubmission.similarity_score * 100).toFixed(3)}%</p>
                      </div>
                    </>
                  )}
                </div>
                </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      {/* Plagiarism Comparison Modal */}
      {selectedFiles && (
        <Modal
          open={isCompareModalOpen}
          onCancel={handleCloseCompareModal}
          footer={null}
          width="90%"
          style={{ top: 20 }}
          closeIcon={null}
        >
          {similarityData && (
            <PlagiarismCompare
              file1Path={selectedFiles.file1}
              file2Path={selectedFiles.file2}
              onClose={handleCloseCompareModal}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              similarityData={similarityData as any}
            />
          )}
        </Modal>
      )}
    </div>
  );
};

export default Results;
