import React, { useState, useRef, useEffect } from "react";
import * as monaco from "monaco-editor";
import { message } from "antd";

const CodeSimilarityViewer = ({ file1Content, file2Content, spanClusters }) => {
  const editorARef = useRef(null);
  const editorBRef = useRef(null);
  const editorAInstance = useRef(null);
  const editorBInstance = useRef(null);
  const currentHighlightedCluster = useRef(null);

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
    };

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

    const mouseHandlerA = editorAInstance.current.onMouseMove(
      handleMouseMove(editorAInstance.current, true)
    );
    const mouseHandlerB = editorBInstance.current.onMouseMove(
      handleMouseMove(editorBInstance.current, false)
    );

    return () => {
      mouseHandlerA.dispose();
      mouseHandlerB.dispose();
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

  return (
    <div style={{ display: "flex", width: "100%", height: "600px" }}>
      <div
        ref={editorARef}
        style={{
          width: "50%",
          height: "100%",
          borderRight: "1px solid #e0e0e0",
        }}
      />
      <div
        ref={editorBRef}
        style={{
          width: "50%",
          height: "100%",
          borderLeft: "1px solid #e0e0e0",
        }}
      />
    </div>
  );
};

export default CodeSimilarityViewer;
