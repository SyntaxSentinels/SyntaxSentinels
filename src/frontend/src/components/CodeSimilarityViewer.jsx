import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';

const CodeSimilarityViewer = ({ 
  fileA = '', 
  fileB = '', 
  spanClusters = [] 
}) => {
  const editorARef = useRef(null);
  const editorBRef = useRef(null);
  const editorAInstance = useRef(null);
  const editorBInstance = useRef(null);
  const currentHighlightedCluster = useRef(null);

  useEffect(() => {
    if (!editorARef.current || !editorBRef.current) return;

    if (!editorAInstance.current) {
      editorAInstance.current = monaco.editor.create(editorARef.current, {
        value: fileA,
        language: 'python',
        readOnly: true,
        minimap: { enabled: false },
        renderLineHighlight: 'none'
      });
    }

    if (!editorBInstance.current) {
      editorBInstance.current = monaco.editor.create(editorBRef.current, {
        value: fileB,
        language: 'python',
        readOnly: true,
        minimap: { enabled: false },
        renderLineHighlight: 'none'
      });
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
          const baseColor = this.generateGrayShade(index);
          const hoverColor = this.generateHoverColor(index);
          this.clusterStyles.set(cluster, { baseColor, hoverColor });

          const createDecoration = (span) => ({
            range: new monaco.Range(span.startLine, span.startColumn, span.endLine, span.endColumn),
            options: { inlineClassName: `highlight-${index}` }
          });

          this.decorationsA.push(
            ...editorAInstance.current.deltaDecorations([], cluster.sourceSpans.map(createDecoration))
          );

          this.decorationsB.push(
            ...editorBInstance.current.deltaDecorations([], cluster.targetSpans.map(createDecoration))
          );

          if (!document.getElementById(`style-highlight-${index}`)) {
            const style = document.createElement('style');
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
          document.querySelectorAll(`.highlight-${index}`).forEach(el => {
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
          document.querySelectorAll(`.highlight-${index}`).forEach(el => {
            el.classList.add(`highlight-hover-${index}`);
          });
        }
      }
    };

    highlightManager.applyDefaultHighlight();

    const handleMouseMove = (editor, isSource) => (e) => {
      if (!e || !e.target) return;
      const { lineNumber, column } = e.target.position || {};
      if (!lineNumber || !column) return;

      const matchingCluster = spanClusters.find(cluster => {
        const spans = isSource ? cluster.sourceSpans : cluster.targetSpans;
        return spans.some(span => 
          lineNumber >= span.startLine && 
          lineNumber <= span.endLine &&
          (lineNumber !== span.endLine || column <= span.endColumn) &&
          (lineNumber !== span.startLine || column >= span.startColumn)
        );
      });

      if (matchingCluster) {
        highlightManager.applyHoverHighlight(matchingCluster);
      } else {
        highlightManager.clearHoverHighlight();
      }
    };

    const mouseHandlerA = editorAInstance.current.onMouseMove(handleMouseMove(editorAInstance.current, true));
    const mouseHandlerB = editorBInstance.current.onMouseMove(handleMouseMove(editorBInstance.current, false));

    return () => {
      mouseHandlerA.dispose();
      mouseHandlerB.dispose();
      highlightManager.clearHoverHighlight();

      if (editorAInstance.current) editorAInstance.current.dispose();
      if (editorBInstance.current) editorBInstance.current.dispose();

      editorAInstance.current = null;
      editorBInstance.current = null;
    };
  }, [fileA, fileB, spanClusters]);

  return (
    <div style={{ display: 'flex', width: '100%' }}>
      <div ref={editorARef} style={{ width: '50%', height: '100%', borderRight: '1px solid #e0e0e0' }} />
      <div ref={editorBRef} style={{ width: '50%', height: '100%', borderLeft: '1px solid #e0e0e0' }} />
    </div>
  );
};

export default CodeSimilarityViewer;
