import React, { useRef, useEffect, useState } from "react";
import * as monaco from "monaco-editor";
import { Spin, message } from "antd"; // For loading indicator and errors
import { getFileContentsFromDB } from "@/lib/dbUtils"; // Adjust path
import { compareFilesApi } from "@/services/ssApi"; // Adjust path

// --- Interfaces ---
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

// Interface for the data returned by the comparison API
interface DetailedComparisonResult {
  file1: string; // Should match file1Name prop
  file2: string; // Should match file2Name prop
  similarity_score: number;
  matches: MatchCluster[]; // Matches from the API (ss, ts)
}

// --- Helper Functions for Span Merging (Keep these or import them) ---
function compareSpan(left, right) {
  let diff = left.sl - right.sl;
  if (diff !== 0) {
    return diff;
  }
  diff = left.sc - right.sc;
  if (diff !== 0) {
    return diff;
  }
  diff = left.el - right.el;
  if (diff !== 0) {
    return diff;
  }
  diff = left.ec - right.ec;
  if (diff !== 0) {
    return diff;
  }
  return 0;
}

function mergeSpans(one, other) {
  let sl, sc, el, ec;
  if (one.sl < other.sl) {
    sl = one.sl;
    sc = one.sc;
  } else if (one.sl > other.sl) {
    sl = other.sl;
    sc = other.sc;
  } else {
    sl = one.sl;
    sc = Math.min(one.sc, other.sc);
  }
  if (one.el > other.el) {
    el = one.el;
    ec = one.ec;
  } else if (one.el < other.el) {
    el = other.el;
    ec = other.ec;
  } else {
    el = one.el;
    ec = Math.max(one.ec, other.ec);
  }
  return {
    sl: sl,
    sc: sc,
    el: el,
    ec: ec,
  };
}

function spansOverlap(span1, span2): boolean {
  const [left, right] = [span1, span2].sort(compareSpan);
  if (left.el < right.sl) {
    return false;
  } else if (left.el === right.sl) {
    return right.sc < left.ec;
  } else {
    return true;
  }
}

function mergeOverlappingSpans(
  matches: MatchCluster[]
): MatchCluster[] {
  // Helper function to merge spans in a list
  function mergeSpansList(spans) {
    // Sort spans by sl and sc
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
    // Check if there is any overlap in ss
    const sourceOverlap = match1.ss.some((span1) =>
      match2.ss.some((span2) => spansOverlap(span1, span2))
    );
    // Check if there is any overlap in ts
    const targetOverlap = match1.ts.some((span1) =>
      match2.ts.some((span2) => spansOverlap(span1, span2))
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
        existingMatch.ss = mergeSpansList([
          ...existingMatch.ss,
          ...currentMatch.ss,
        ]);
        existingMatch.ts = mergeSpansList([
          ...existingMatch.ts,
          ...currentMatch.ts,
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
  file1Name: string,
  file2Name: string,
  file1Content: string,
  file2Content: string,
}

export const CodeSimilarityViewer: React.FC<CodeSimilarityViewerProps> = ({
  file1Name,
  file2Name,
  file1Content,
  file2Content,
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
  const currentHighlightedCluster = useRef(null);

  // --- Internal State ---
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spanClusters, setSpanClusters] = useState<MatchCluster[]>([]);

  // --- Effect to Fetch Data and Compare ---
  useEffect(() => {
    const fetchAndCompareData = async () => {
      // if (!jobId || !file1Name || !file2Name) {
      //   setError(
      //     "Missing required information (jobId, file names) to load comparison."
      //   );
      //   setIsLoading(false);
      //   return;
      // }

      setIsLoading(true);
      setError(null);
      setSpanClusters([]);

      try {
        // 2. Call comparison API
        // Provide default k/w or make them optional in API definition (using Option 2 from previous fix here)
        const detailedResult: DetailedComparisonResult = await compareFilesApi({
          file1Content: file1Content,
          file2Content: file2Content,
          file1Name: file1Name,
          file2Name: file1Name,
          k: 7, // Example default
          w: 4, // Example default
        });
        console.log(detailedResult);
        // 3. Map API response (ss/ts) to viewer format (ss/ts)
        const apiMatches = detailedResult.matches || [];
        let mappedMatchesForViewer: MatchCluster[] = apiMatches.map(
          (match) => ({
            ss: match.ss || [],
            ts: match.ts || [],
          })
        );

        // 4. Merge overlapping spans
        let keepGoing = true;
        while (keepGoing) {
          console.log("merging spans", mappedMatchesForViewer);
          keepGoing = false;
          const oldSize = Object.keys(mappedMatchesForViewer).length;
          mappedMatchesForViewer = mergeOverlappingSpans(mappedMatchesForViewer);
          const newSize = Object.keys(mappedMatchesForViewer).length;
          if (oldSize != newSize) {
            keepGoing = true;
          }
        }
        console.log("done ", mappedMatchesForViewer);

        // 5. Set the final cluster data
        setSpanClusters(mappedMatchesForViewer);
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
  }, [file1Name, file2Name, file1Content, file2Content]);

  useEffect(() => {
    if (!file1Content || !file2Content || !spanClusters) return;
    if (!editorARef.current || !editorBRef.current) return;

    if (!editorAInstance.current) {
      editorAInstance.current = monaco.editor.create(editorARef.current, {
        value: file1Content,
        language: "python",
        readOnly: true,
        minimap: { enabled: false },
        renderLineHighlight: "none",
      });
    } else {
      editorAInstance.current.setValue(file1Content);
    }

    if (!editorBInstance.current) {
      editorBInstance.current = monaco.editor.create(editorBRef.current, {
        value: file2Content,
        language: "python",
        readOnly: true,
        minimap: { enabled: false },
        renderLineHighlight: "none",
      });
    } else {
      editorBInstance.current.setValue(file2Content);
    }

    const highlightManager = {
      decorationsA: [],
      decorationsB: [],
      clusterStyles: new Map(),
      
      // Track visible ranges for both editors
      visibleRangeA: null,
      visibleRangeB: null,

      generateGrayShade(index) {
        const lightness = 85 - (index % 10) * 5;
        return `hsla(0, 0%, ${lightness}%, 0.5)`;
      },

      generateHoverColor(index) {
        const colorIndex = (index * 137) % 360;
        return `hsla(${colorIndex}, 80%, 60%, 0.4)`;
      },

      applyDefaultHighlight() {
        spanClusters.forEach((cluster, index) => {
          console.log(cluster);
          const baseColor = this.generateGrayShade(index);
          const hoverColor = this.generateHoverColor(index);
          this.clusterStyles.set(cluster, { baseColor, hoverColor });

          const createDecoration = (span) => ({
            range: new monaco.Range(span.sl, span.sc, span.el, span.ec),
            options: { inlineClassName: `highlight-${index}` },
          });

          this.decorationsA.push(
            ...editorAInstance.current.deltaDecorations(
              [],
              cluster.ss.map(createDecoration)
            )
          );

          this.decorationsB.push(
            ...editorBInstance.current.deltaDecorations(
              [],
              cluster.ts.map(createDecoration)
            )
          );

          if (!document.getElementById(`style-highlight-${index}`)) {
            const style = document.createElement("style");
            style.id = `style-highlight-${index}`;
            style.textContent = `
              .highlight-${index} { background-color: ${baseColor}; border-radius: 3px; }
              .highlight-hover-${index} { background-color: ${hoverColor} !important; }
            `;
            document.head.appendChild(style);
          }
        });
      },

      clearHoverHighlight() {
        if (!currentHighlightedCluster.current) return;

        const index = spanClusters.indexOf(currentHighlightedCluster.current);
        if (index !== -1) {
          document.querySelectorAll(`.highlight-${index}`).forEach((el) => {
            el.classList.remove(`highlight-hover-${index}`);
          });
        }
        currentHighlightedCluster.current = null;
      },

      applyHoverHighlight(cluster) {
        if (currentHighlightedCluster.current === cluster) return;
        this.clearHoverHighlight();

        currentHighlightedCluster.current = cluster;
        const index = spanClusters.indexOf(cluster);
        if (index !== -1) {
          document.querySelectorAll(`.highlight-${index}`).forEach((el) => {
            el.classList.add(`highlight-hover-${index}`);
          });
        }
      },
      
      // Check for highlights in visible range
      checkVisibleHighlights() {
        if (!editorAInstance.current || !editorBInstance.current) return;
        
        // Get current visible ranges
        const visibleRangeA = editorAInstance.current.getVisibleRanges()[0];
        const visibleRangeB = editorBInstance.current.getVisibleRanges()[0];
        
        if (!visibleRangeA || !visibleRangeB) return;
        
        // Check if mouse is over any span in the visible ranges
        let foundMatch = false;
        
        // First check editor A (source)
        for (const cluster of spanClusters) {
          for (const span of cluster.ss) {
            // Check if span overlaps with visible range
            if (
              span.sl <= visibleRangeA.endLineNumber &&
              span.el >= visibleRangeA.startLineNumber
            ) {
              // Check if mouse cursor is within this span's position
              const position = editorAInstance.current.getPosition();
              if (position) {
                const { lineNumber, column } = position;
                if (
                  lineNumber >= span.sl &&
                  lineNumber <= span.el &&
                  (lineNumber !== span.el || column <= span.ec) &&
                  (lineNumber !== span.sl || column >= span.sc)
                ) {
                  this.applyHoverHighlight(cluster);
                  foundMatch = true;
                  break;
                }
              }
            }
          }
          if (foundMatch) break;
        }
        
        // If no match found in editor A, check editor B (target)
        if (!foundMatch) {
          for (const cluster of spanClusters) {
            for (const span of cluster.ts) {
              // Check if span overlaps with visible range
              if (
                span.sl <= visibleRangeB.endLineNumber &&
                span.el >= visibleRangeB.startLineNumber
              ) {
                // Check if mouse cursor is within this span's position
                const position = editorBInstance.current.getPosition();
                if (position) {
                  const { lineNumber, column } = position;
                  if (
                    lineNumber >= span.sl &&
                    lineNumber <= span.el &&
                    (lineNumber !== span.el || column <= span.ec) &&
                    (lineNumber !== span.sl || column >= span.sc)
                  ) {
                    this.applyHoverHighlight(cluster);
                    foundMatch = true;
                    break;
                  }
                }
              }
            }
            if (foundMatch) break;
          }
        }
        
        // If no match found in either editor, clear highlight
        if (!foundMatch) {
          this.clearHoverHighlight();
        }
      },
      
      dispose() {
        this.clearHoverHighlight();
        // Clear any additional resources if needed
      }
    };
    
    // Store the highlight manager reference
    highlightManagerRef.current = highlightManager;

    highlightManager.applyDefaultHighlight();

    const handleMouseMove = (editor, isSource) => (e) => {
      if (!e || !e.target) return;
      const { lineNumber, column } = e.target.position || {};
      if (!lineNumber || !column) return;

      const matchingCluster = spanClusters.find((cluster) => {
        const spans = isSource ? cluster.ss : cluster.ts;
        return spans.some(
          (span) =>
            lineNumber >= span.sl &&
            lineNumber <= span.el &&
            (lineNumber !== span.el || column <= span.ec) &&
            (lineNumber !== span.sl || column >= span.sc)
        );
      });

      if (matchingCluster) {
        highlightManager.applyHoverHighlight(matchingCluster);
      } else {
        highlightManager.clearHoverHighlight();
      }
    };

    // Add scroll event handlers for both editors
    const handleScroll = () => {
      highlightManager.checkVisibleHighlights();
    };

    // Set up mouse and scroll events
    const mouseHandlerA = editorAInstance.current.onMouseMove(
      handleMouseMove(editorAInstance.current, true)
    );
    const mouseHandlerB = editorBInstance.current.onMouseMove(
      handleMouseMove(editorBInstance.current, false)
    );
    
    const scrollHandlerA = editorAInstance.current.onDidScrollChange(handleScroll);
    const scrollHandlerB = editorBInstance.current.onDidScrollChange(handleScroll);

    // Also handle cursor position changes to update highlights when navigating with keyboard
    const cursorHandlerA = editorAInstance.current.onDidChangeCursorPosition(handleScroll);
    const cursorHandlerB = editorBInstance.current.onDidChangeCursorPosition(handleScroll);

    return () => {
      // Clean up all event handlers
      mouseHandlerA.dispose();
      mouseHandlerB.dispose();
      scrollHandlerA.dispose();
      scrollHandlerB.dispose();
      cursorHandlerA.dispose();
      cursorHandlerB.dispose();
      
      highlightManager.clearHoverHighlight();

      if (editorAInstance.current) {
        editorAInstance.current.dispose();
        editorAInstance.current = null;
      }
      if (editorBInstance.current) {
        editorBInstance.current.dispose();
        editorBInstance.current = null;
      }
    };
  }, [file1Content, file2Content, spanClusters]);

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
