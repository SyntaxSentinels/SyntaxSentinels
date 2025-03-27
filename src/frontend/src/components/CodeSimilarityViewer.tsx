import React, { useRef, useEffect, useState } from "react";
import * as monaco from "monaco-editor";
import { Spin, message } from "antd"; // For loading indicator and errors
import { getFileContentsFromDB } from "@/lib/dbUtils"; // Adjust path
import { compareFilesApi } from "@/services/ssApi"; // Adjust path

// --- Interfaces ---
interface Span {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

// Interface for the matches structure expected by this component's highlighting logic
interface ViewerMatchCluster {
  sourceSpans: Span[];
  targetSpans: Span[];
}

// Interface for the matches structure coming from the API (assuming ss/ts)
interface ApiMatchCluster {
  ss: Span[];
  ts: Span[];
}

// Interface for the data returned by the comparison API
interface DetailedComparisonResult {
  file1: string; // Should match file1Name prop
  file2: string; // Should match file2Name prop
  similarity_score: number;
  matches: ApiMatchCluster[]; // Matches from the API (ss, ts)
}

// --- Helper Functions for Span Merging (Keep these or import them) ---
function compareSpan(left, right) {
  let diff = left.startLine - right.startLine;
  if (diff !== 0) {
    return diff;
  }
  diff = left.startColumn - right.startColumn;
  if (diff !== 0) {
    return diff;
  }
  diff = left.endLine - right.endLine;
  if (diff !== 0) {
    return diff;
  }
  diff = left.endColumn - right.endColumn;
  if (diff !== 0) {
    return diff;
  }
  return 0;
}

function mergeSpans(one, other) {
  let startLine, startColumn, endLine, endColumn;
  if (one.startLine < other.startLine) {
    startLine = one.startLine;
    startColumn = one.startColumn;
  } else if (one.startLine > other.startLine) {
    startLine = other.startLine;
    startColumn = other.startColumn;
  } else {
    startLine = one.startLine;
    startColumn = Math.min(one.startColumn, other.startColumn);
  }
  if (one.endLine > other.endLine) {
    endLine = one.endLine;
    endColumn = one.endColumn;
  } else if (one.endLine < other.endLine) {
    endLine = other.endLine;
    endColumn = other.endColumn;
  } else {
    endLine = one.endLine;
    endColumn = Math.max(one.endColumn, other.endColumn);
  }
  return {
    startLine: startLine,
    startColumn: startColumn,
    endLine: endLine,
    endColumn: endColumn,
  };
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

function mergeOverlappingSpans(
  matches: ViewerMatchCluster[]
): ViewerMatchCluster[] {
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
    const sourceOverlap = match1.sourceSpans.some((span1) =>
      match2.sourceSpans.some((span2) => spansOverlap(span1, span2))
    );
    // Check if there is any overlap in targetSpans
    const targetOverlap = match1.targetSpans.some((span1) =>
      match2.targetSpans.some((span2) => spansOverlap(span1, span2))
    );
    return sourceOverlap || targetOverlap;
  }

  // Start with an empty list for merged matches
  const mergedMatches = [];

  // Loop through all matches and attempt to merge them
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    let merged = false;

    // Try to merge the current match with any match in the mergedMatches list
    for (let j = 0; j < mergedMatches.length; j++) {
      const existingMatch = mergedMatches[j];

      // If the current match overlaps with an existing match, merge them
      if (matchesOverlap(currentMatch, existingMatch)) {
        existingMatch.sourceSpans = mergeSpansList([
          ...existingMatch.sourceSpans,
          ...currentMatch.sourceSpans,
        ]);
        existingMatch.targetSpans = mergeSpansList([
          ...existingMatch.targetSpans,
          ...currentMatch.targetSpans,
        ]);
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

// --- Define Props for the Component ---
interface CodeSimilarityViewerProps {
  jobId: string | null;
  file1Name: string | null;
  file2Name: string | null;
  // Remove fileA, fileB, spanClusters from props
}

export const CodeSimilarityViewer: React.FC<CodeSimilarityViewerProps> = ({
  jobId,
  file1Name,
  file2Name,
}) => {
  const editorARef = useRef<HTMLDivElement>(null);
  const editorBRef = useRef<HTMLDivElement>(null);
  const editorAInstance = useRef<monaco.editor.IStandaloneCodeEditor | null>(
    null
  );
  const editorBInstance = useRef<monaco.editor.IStandaloneCodeEditor | null>(
    null
  );
  const highlightManagerRef = useRef<any>(null); // To store highlight manager instance

  // --- Internal State ---
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileAContent, setFileAContent] = useState<string>("");
  const [fileBContent, setFileBContent] = useState<string>("");
  const [clusters, setClusters] = useState<ViewerMatchCluster[]>([]);

  // --- Effect to Fetch Data and Compare ---
  useEffect(() => {
    const fetchAndCompareData = async () => {
      console.log(jobId, file1Name, file2Name); // Debugging log
      if (!jobId || !file1Name || !file2Name) {
        setError(
          "Missing required information (jobId, file names) to load comparison."
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setFileAContent(""); // Clear previous
      setFileBContent("");
      setClusters([]);

      try {
        // 1. Fetch content from IndexedDB
        const allJobContents = await getFileContentsFromDB(jobId);
        if (!allJobContents)
          throw new Error(`File contents not found locally for job ${jobId}.`);

        const fetchedFileAContent = allJobContents[file1Name];
        const fetchedFileBContent = allJobContents[file2Name];
        if (
          fetchedFileAContent === undefined ||
          fetchedFileBContent === undefined
        ) {
          throw new Error(`Content missing for ${file1Name} or ${file2Name}.`);
        }

        // Store content immediately for potential editor update
        setFileAContent(fetchedFileAContent);
        setFileBContent(fetchedFileBContent);

        // 2. Call comparison API
        // Provide default k/w or make them optional in API definition (using Option 2 from previous fix here)
        const detailedResult: DetailedComparisonResult = await compareFilesApi({
          file1Content: fetchedFileAContent,
          file2Content: fetchedFileBContent,
          file1Name,
          file2Name,
          k: 7, // Example default
          w: 4, // Example default
        });

        // 3. Map API response (ss/ts) to viewer format (sourceSpans/targetSpans)
        const apiMatches = detailedResult.matches || [];
        const mappedMatchesForViewer: ViewerMatchCluster[] = apiMatches.map(
          (match) => ({
            sourceSpans: match.ss || [],
            targetSpans: match.ts || [],
          })
        );

        // 4. Merge overlapping spans
        const mergedMatchesForViewer = mergeOverlappingSpans(
          mappedMatchesForViewer
        );

        // 5. Set the final cluster data
        setClusters(mergedMatchesForViewer);
      } catch (err: any) {
        console.error("Error loading comparison data:", err);
        const errorMsg = err.message || "Failed to load comparison details.";
        setError(errorMsg);
        message.error(errorMsg); // Show feedback to user
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndCompareData();
  }, [jobId, file1Name, file2Name]); // Re-run if these props change

  // --- Effect to Setup/Update Monaco Editors and Highlighting ---
  useEffect(() => {
    // Ensure refs are available
    if (!editorARef.current || !editorBRef.current) return;

    // --- Initialize or Update Editor A ---
    if (!editorAInstance.current) {
      editorAInstance.current = monaco.editor.create(editorARef.current, {
        value: fileAContent, // Use state variable
        language: "python",
        readOnly: true,
        minimap: { enabled: false },
        // renderLineHighlight: 'none', // Keep if desired
        scrollBeyondLastLine: false, // Optional preference
        automaticLayout: true, // Adjust layout on container resize
      });
    } else {
      // If instance exists, update content if it changed
      if (editorAInstance.current.getValue() !== fileAContent) {
        editorAInstance.current.setValue(fileAContent);
      }
    }

    // --- Initialize or Update Editor B ---
    if (!editorBInstance.current) {
      editorBInstance.current = monaco.editor.create(editorBRef.current, {
        value: fileBContent, // Use state variable
        language: "python",
        readOnly: true,
        minimap: { enabled: false },
        // renderLineHighlight: 'none',
        scrollBeyondLastLine: false,
        automaticLayout: true,
      });
    } else {
      // If instance exists, update content if it changed
      if (editorBInstance.current.getValue() !== fileBContent) {
        editorBInstance.current.setValue(fileBContent);
      }
    }

    // --- Setup Highlighting ---
    // Ensure editors are fully initialized before setting up highlights
    if (!editorAInstance.current || !editorBInstance.current) return;

    // Clear previous highlights and styles before applying new ones
    if (highlightManagerRef.current) {
      highlightManagerRef.current.dispose();
    }

    // Define Highlight Manager (nested to capture current editor instances and clusters)
    const HighlightManager = class {
      editorA: monaco.editor.IStandaloneCodeEditor;
      editorB: monaco.editor.IStandaloneCodeEditor;
      spanClusters: ViewerMatchCluster[];
      decorationsAIds: string[] = [];
      decorationsBIds: string[] = [];
      clusterStyles = new Map<
        ViewerMatchCluster,
        { baseColor: string; hoverColor: string }
      >();
      styleElements: HTMLStyleElement[] = [];
      currentHighlightedCluster: ViewerMatchCluster | null = null;
      mouseMoveListeners: monaco.IDisposable[] = [];

      constructor(
        editorA: monaco.editor.IStandaloneCodeEditor,
        editorB: monaco.editor.IStandaloneCodeEditor,
        clusters: ViewerMatchCluster[]
      ) {
        this.editorA = editorA;
        this.editorB = editorB;
        this.spanClusters = clusters;
      }

      // --- Methods for generating colors, applying/clearing highlights (same as before) ---
      generateGrayShade(index: number) {
        /* ... */
      }
      generateHoverColor(index: number) {
        /* ... */
      }

      applyDefaultHighlight() {
        const newDecorationsA: monaco.editor.IModelDeltaDecoration[] = [];
        const newDecorationsB: monaco.editor.IModelDeltaDecoration[] = [];

        this.spanClusters.forEach((cluster, index) => {
          const baseColor = this.generateGrayShade(index);
          const hoverColor = this.generateHoverColor(index);
          this.clusterStyles.set(cluster, { baseColor, hoverColor });

          const createDecoration = (
            span: Span
          ): monaco.editor.IModelDeltaDecoration => ({
            range: new monaco.Range(
              span.startLine,
              span.startColumn,
              span.endLine,
              span.endColumn
            ),
            options: {
              inlineClassName: `highlight-${index}`, // Apply base style class
              stickiness:
                monaco.editor.TrackedRangeStickiness
                  .NeverGrowsWhenTypingAtEdges,
            },
          });

          cluster.sourceSpans.forEach((span) =>
            newDecorationsA.push(createDecoration(span))
          );
          cluster.targetSpans.forEach((span) =>
            newDecorationsB.push(createDecoration(span))
          );

          // --- Inject CSS for base and hover states ---
          const styleId = `style-highlight-${index}`;
          if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.textContent = `
                      .highlight-${index} { background-color: ${baseColor}; border-radius: 2px; cursor: pointer; transition: background-color 0.1s ease-in-out; }
                      .highlight-hover-${index} { background-color: ${hoverColor} !important; }
                    `;
            document.head.appendChild(style);
            this.styleElements.push(style); // Keep track to remove later
          }
        });

        // Apply decorations (replace old ones)
        this.decorationsAIds = this.editorA.deltaDecorations(
          this.decorationsAIds,
          newDecorationsA
        );
        this.decorationsBIds = this.editorB.deltaDecorations(
          this.decorationsBIds,
          newDecorationsB
        );
      }

      clearHoverHighlight() {
        if (!this.currentHighlightedCluster) return;
        const index = this.spanClusters.indexOf(this.currentHighlightedCluster);
        if (index === -1) return;
        // Find all elements (across both editors if needed, though usually specific)
        document.querySelectorAll(`.highlight-${index}`).forEach((el) => {
          el.classList.remove(`highlight-hover-${index}`);
        });
        this.currentHighlightedCluster = null;
      }

      applyHoverHighlight(cluster: ViewerMatchCluster) {
        if (this.currentHighlightedCluster === cluster) return;
        this.clearHoverHighlight(); // Clear previous hover

        this.currentHighlightedCluster = cluster;
        const index = this.spanClusters.indexOf(cluster);
        if (index === -1) return;
        // Find all elements with the base class and add the hover class
        document.querySelectorAll(`.highlight-${index}`).forEach((el) => {
          el.classList.add(`highlight-hover-${index}`);
        });
      }

      // --- Setup mouse move listeners ---
      setupMouseListeners() {
        const handleMouseMove =
          (isSource: boolean) => (e: monaco.editor.IEditorMouseEvent) => {
            if (
              !e ||
              !e.target ||
              e.target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT
            ) {
              this.clearHoverHighlight(); // Clear if mouse is not over text
              return;
            }
            const position = e.target.position;
            if (!position) return;

            const matchingCluster = this.spanClusters.find((cluster) => {
              const spans = isSource
                ? cluster.sourceSpans
                : cluster.targetSpans;
              return spans.some(
                (span) =>
                  position.lineNumber >= span.startLine &&
                  position.lineNumber <= span.endLine &&
                  (position.lineNumber !== span.endLine ||
                    position.column <= span.endColumn) &&
                  (position.lineNumber !== span.startLine ||
                    position.column >= span.startColumn)
              );
            });

            if (matchingCluster) {
              this.applyHoverHighlight(matchingCluster);
            } else {
              this.clearHoverHighlight();
            }
          };

        // Clear previous listeners before adding new ones
        this.mouseMoveListeners.forEach((listener) => listener.dispose());
        this.mouseMoveListeners = [];

        this.mouseMoveListeners.push(
          this.editorA.onMouseMove(handleMouseMove(true))
        );
        this.mouseMoveListeners.push(
          this.editorB.onMouseMove(handleMouseMove(false))
        );
        // Add listener to clear hover when mouse leaves editor area
        this.mouseMoveListeners.push(
          this.editorA.onMouseLeave(() => this.clearHoverHighlight())
        );
        this.mouseMoveListeners.push(
          this.editorB.onMouseLeave(() => this.clearHoverHighlight())
        );
      }

      // --- Cleanup method ---
      dispose() {
        // Remove decorations
        if (this.editorA)
          this.editorA.deltaDecorations(this.decorationsAIds, []);
        if (this.editorB)
          this.editorB.deltaDecorations(this.decorationsBIds, []);
        this.decorationsAIds = [];
        this.decorationsBIds = [];
        // Remove listeners
        this.mouseMoveListeners.forEach((listener) => listener.dispose());
        this.mouseMoveListeners = [];
        // Remove injected styles
        this.styleElements.forEach((style) => style.remove());
        this.styleElements = [];
        this.clusterStyles.clear();
        this.currentHighlightedCluster = null;
      }
    }; // End HighlightManager class definition

    // Create and setup the manager
    const manager = new HighlightManager(
      editorAInstance.current,
      editorBInstance.current,
      clusters
    );
    manager.applyDefaultHighlight();
    manager.setupMouseListeners();
    highlightManagerRef.current = manager; // Store the instance

    // --- Cleanup on unmount or when dependencies change ---
    return () => {
      manager.dispose(); // Use manager's cleanup method
      highlightManagerRef.current = null;

      // Only dispose editors if the component *itself* is unmounting
      // If just props change, we reuse the editor instances
      // This cleanup needs refinement if props changing should fully recreate editors.
      // For now, let's assume we update content and highlights.
    };
  }, [fileAContent, fileBContent, clusters]); // Rerun setup if content or clusters change

  // --- Effect for Full Editor Disposal on Unmount ---
  useEffect(() => {
    // Return a cleanup function that runs only when the component unmounts
    return () => {
      console.log("Disposing Monaco editors on unmount");
      if (editorAInstance.current) {
        editorAInstance.current.dispose();
        editorAInstance.current = null;
      }
      if (editorBInstance.current) {
        editorBInstance.current.dispose();
        editorBInstance.current = null;
      }
      // Also clear highlights just in case
      if (highlightManagerRef.current) {
        highlightManagerRef.current.dispose();
        highlightManagerRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only once on unmount

  // --- Render Logic ---
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "600px",
        }}
      >
        <Spin size="large" tip="Loading comparison..." />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "20px",
          color: "red",
          height: "600px",
          textAlign: "center",
        }}
      >
        Error loading comparison: {error}
      </div>
    );
  }

  // Render editors only after loading is complete and no error
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "600px",
        border: "1px solid #ccc",
      }}
    >
      <div
        ref={editorARef}
        style={{ flex: 1, height: "100%", borderRight: "1px solid #ccc" }}
      />
      <div ref={editorBRef} style={{ flex: 1, height: "100%" }} />
    </div>
  );
};
