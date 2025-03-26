import { useNavigate } from "react-router-dom";
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
import { Button, Pagination, Spin, Slider, message } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import CodeSimilarityViewer from "@/components/CodeSimilarityViewer";

// Interfaces for our data structures
interface SimilarityResult {
  file1: string;
  file2: string;
  similarity_score: number;
}

interface SimilarityStats {
  highestSimilarity: number;
  averageSimilarity: number;
  medianSimilarity: number;
  totalSubmissions: number;
}

function numberOfFiles(x) {
  return (1+ (1+8 *x)**0.5)/2
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

const Results = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState<SimilarityResult[]>([]);
  const [stats, setStats] = useState<SimilarityStats>({
    highestSimilarity: 0,
    averageSimilarity: 0,
    medianSimilarity: 0,
    totalSubmissions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [threshold, setThreshold] = useState(50);
  const [filteredResults, setFilteredResults] = useState<SimilarityResult[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const itemsPerPage = 20; // Show only 20 items per page

  useEffect(() => {
    setLoading(true);
    // Retrieve results from local storage
    setTimeout(() => {
      const storedData = localStorage.getItem("resultsData");
      if (!storedData) {
        message.error("No data found. Please submit code files first.");
        navigate("/");
        return;
      }

      try {
        const jsonData: SimilarityResult[] = JSON.parse(storedData);
        if (!Array.isArray(jsonData) || jsonData.length === 0) {
          message.error("No data found. Please submit code files first.");
          navigate("/");
          return;
        }

        const similarityValues = jsonData.map((r) => r.similarity_score * 100);
        const highest = Math.max(...similarityValues);
        const avg = Math.round(
          similarityValues.reduce((acc, val) => acc + val, 0) / jsonData.length
        );
        const median = calculateMedian(similarityValues);

        setResults(
          jsonData.sort((a, b) => b.similarity_score - a.similarity_score)
        );

        // Filter results based on threshold
        setFilteredResults(
          jsonData.sort((a, b) => b.similarity_score - a.similarity_score)
        );

        setStats({
          highestSimilarity: highest,
          averageSimilarity: avg,
          medianSimilarity: median,
          totalSubmissions: jsonData.length,
        });
      } catch {
        message.error("An error occurred while fetching data. Please try again.");
        navigate("/");
      } finally {
        setLoading(false);
      }
    }, 500); // Simulate a slight delay for smoother loading
  }, [navigate]);

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

  // FIXME: This is just test data for now
  const fileA = "def add(a, b):\n    result = a + b\n    return result  # This line is mapped\n\ndef multiply(x, y):\n    product = x * y\n    return product  # This spans multiple lines";
  const fileB = "def sum_numbers(a, b):\n    total = a + b\n    return total  # This line maps to File A's return statement\n\ndef multiply_values(x, y):\n    multiplied = x * y\n    return multiplied  # This spans multiple lines";
  const spanClusters = [
    {
      "sourceSpans": [{ "startLine": 1, "startColumn": 5, "endLine": 1, "endColumn": 8 }], 
      "targetSpans": [{ "startLine": 1, "startColumn": 5, "endLine": 1, "endColumn": 15 }, { "startLine": 1, "startColumn": 18, "endLine": 2, "endColumn": 3 }]
    },
    {
      "sourceSpans": [{ "startLine": 2, "startColumn": 12, "endLine": 2, "endColumn": 13 }],
      "targetSpans": [{ "startLine": 2, "startColumn": 12, "endLine": 2, "endColumn": 13 }]
    }
  ]
  
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto">
        {/* Back Button */}
        <Button
          type="default"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/")}
          className="mb-6"
        >
          Back
        </Button>

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
                <p className="text-4xl font-bold">{numberOfFiles(stats.totalSubmissions)}</p>
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
              <h2 className="text-lg font-semibold mb-2">Similarity Threshold: {threshold}%</h2>
              <Slider min={0} max={100} step={1} value={threshold} onChange={setThreshold} tooltipVisible className="w-full" />
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
                  <DialogTitle>Edit profile</DialogTitle>
                </DialogHeader>
                  <CodeSimilarityViewer 
                  fileA={fileA}
                  fileB={fileB}
                  spanClusters={spanClusters}
                />
                <div>
                  {selectedSubmission && (
                    <div>
                      <p><strong>File 1:</strong> {selectedSubmission.file1}</p>
                      <p><strong>File 2:</strong> {selectedSubmission.file2}</p>
                      <p><strong>Similarity:</strong> {(selectedSubmission.similarity_score * 100).toFixed(3)}%</p>
                    </div>
                  )}
                </div>
                </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </div>
  );
};

export default Results;
