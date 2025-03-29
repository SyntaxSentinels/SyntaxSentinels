// services/similarityService.js
import { parser } from "@lezer/python";
import { TreeCursor } from "@lezer/common";
import path from "path";

// --- Constants and Enums (Copied from previous script) ---
const NormalizedTokenType = {
  IDENTIFIER: 1,
  NUMERIC_LITERAL: 2,
  STRING_LITERAL: 3,
};
const BASE = 747287;
const MOD = 33554393;
const ROLLING_BASE = 4194301;
const ROLLING_MOD = 33554393;

const kwlist = [
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield'
]

// --- Helper Functions (Copied from previous script) ---
function mod(n, m) {
  return ((n % m) + m) % m;
}

// --- Tokenizer Class (Mostly unchanged, slightly adapted) ---
class Tokenizer {

  _getLineInfo(text, pos) {
    let line = 1;
    let col = 0;
    for (let i = 0; i < pos; i++) {
      if (text[i] === "\n") {
        line++;
        col = 0;
      } else {
        col++;
      }
    }
    return { line, col: col + 1 }; // 1-based column
  }

  _normalizeToken(nodeType, nodeText) {
    // console.log(nodeType, nodeText);
    if (kwlist.includes(nodeText)) {
      return nodeText;
    }
    if (
      nodeType === "Identifier" ||
      nodeType === "VariableName" ||
      nodeType === "PropertyName" ||
      nodeType === "AssignStatement"
    )
      return NormalizedTokenType.IDENTIFIER;
    if (nodeType === "Number" || nodeType === "Integer" || nodeType === "Float")
      return NormalizedTokenType.NUMERIC_LITERAL;
    if (nodeType === "String" || nodeType === "FormatString")
      return NormalizedTokenType.STRING_LITERAL;
    return nodeText.trim();
  }

  _hashToken(token) {
    // ... keep as before ...
    if (typeof token.value === "number") return token.value;
    let hsh = 0;
    for (let i = 0; i < token.value.length; i++) {
      hsh = mod((hsh + token.value.charCodeAt(i)) * BASE, MOD);
    }
    return hsh;
  }

  _tokenizeString(fileContents) {
    // Renamed from _tokenizeFile
    const tokens = [];
    const comments = new Set();
    let tree;

    if (!fileContents || typeof fileContents !== "string") {
      console.error("Error: Invalid input provided for tokenization.");
      return { tokens: [], comments: new Set() }; // Return empty on invalid input
    }

    try {
      tree = parser.parse(fileContents);
    } catch (e) {
      // Log the error appropriately in a real app (using your logger)
      console.error(`Error parsing content: ${e}`);
      // Depending on requirements, you might throw here or return empty
      return { tokens: [], comments: new Set() };
    }

    let maxPos = 0;
    const cursor = tree.cursor();
    do {
      // ... (rest of the traversal logic is identical to _tokenizeFile) ...
      let node = cursor.node;
      const nodeName = node.type.name;
      if (nodeName == "Script") continue;
      
      while (node.firstChild) {
        node = node.firstChild;
      }

      if (node.to <= maxPos) continue;
      maxPos = node.to;
      const startPos = this._getLineInfo(fileContents, node.from);
      const endPos = this._getLineInfo(fileContents, node.to);
      const nodeText = fileContents.substring(node.from, node.to);

      if (nodeName === "Comment") {
        comments.add(nodeText);
        continue;
      }

      const normalized = this._normalizeToken(nodeName, nodeText);

      if (normalized !== "") {
        tokens.push({
          startPos: [startPos.line, startPos.col],
          endPos: [endPos.line, endPos.col],
          value: normalized,
        });
      }
    } while (cursor.next());

    return { tokens, comments };
  }

  _computeRollingHashes(tokens, k) {
    // ... keep as before ...
    const n = tokens.length;
    if (n < k) return [];
    const hashes = [];
    let highOrder = 1;
    for (let i = 0; i < k - 1; i++) {
      highOrder = mod(highOrder * ROLLING_BASE, ROLLING_MOD);
    }
    let h = 0;
    for (let i = 0; i < k; i++) {
      h = mod(h * ROLLING_BASE + this._hashToken(tokens[i]), ROLLING_MOD);
    }
    hashes.push({
      hashVal: h,
      position: 0,
      span: {
        sl: tokens[0].startPos[0],
        sc: tokens[0].startPos[1],
        el: tokens[k - 1].endPos[0],
        ec: tokens[k - 1].endPos[1],
      },
    });
    for (let i = 1; i <= n - k; i++) {
      const leftVal = this._hashToken(tokens[i - 1]);
      const rightVal = this._hashToken(tokens[i + k - 1]);
      h = mod(h - mod(leftVal * highOrder, ROLLING_MOD), ROLLING_MOD);
      h = mod(h * ROLLING_BASE + rightVal, ROLLING_MOD);
      hashes.push({
        hashVal: h,
        position: i,
        span: {
          sl: tokens[i].startPos[0],
          sc: tokens[i].startPos[1],
          el: tokens[i + k - 1].endPos[0],
          ec: tokens[i + k - 1].endPos[1],
        },
      });
    }
    return hashes;
  }

  _winnowing(tokens, k, w) {
    // ... keep as before ...
    const kgramHashes = this._computeRollingHashes(tokens, k);
    const n = kgramHashes.length;
    const fingerprints = new Map();
    if (n === 0) return { kgramHashes, fingerprints };
    if (n < w) {
      let minFp = kgramHashes[0];
      for (let i = 1; i < n; i++)
        if (kgramHashes[i].hashVal <= minFp.hashVal) minFp = kgramHashes[i]; // Simple min for small N
      if (minFp) fingerprints.set(minFp.position, minFp);
    } else {
      for (let i = 0; i <= n - w; i++) {
      // for (let i = n - w; i >= 0; i--) {
        const window = kgramHashes.slice(i, i + w);
        let minFp = window[0];
        for (let j = 1; j < window.length; j++) {
          if (window[j].hashVal < minFp.hashVal) {
            minFp = window[j];
          } else if (
            window[j].hashVal === minFp.hashVal &&
            window[j].position > minFp.position
          ) {
            minFp = window[j]; // Tie-break rightmost
          }
        }
        fingerprints.set(minFp.position, minFp);
      }
    }
    return { kgramHashes, fingerprints };
  }

  hashLcs(seq1, seq2) {
    // ... keep as before ...
    const m = seq1.length,
      n = seq2.length;
    const dp = Array(m + 1)
      .fill(0)
      .map(() => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (seq1[i - 1].hashVal === seq2[j - 1].hashVal)
          dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const lcs1 = [],
      lcs2 = [];
    let i = m,
      j = n;
    while (i > 0 && j > 0) {
      if (seq1[i - 1].hashVal === seq2[j - 1].hashVal) {
        lcs1.push(seq1[i - 1]);
        lcs2.push(seq2[j - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) i--;
      else j--;
    }
    return { lcs1: lcs1.reverse(), lcs2: lcs2.reverse() };
  }
}

/**
 * Compares two code snippets for similarity.
 * @param {string} content1 - The content of the first file.
 * @param {string} content2 - The content of the second file.
 * @param {string} name1 - Optional name for the first file.
 * @param {string} name2 - Optional name for the second file.
 * @param {number} k - k-gram size.
 * @param {number} w - Window size for winnowing.
 * @returns {object} Similarity report object or null if comparison is not meaningful.
 */
function compareTwoFiles(
  content1,
  content2,
  name1,
  name2,
  k = 10,
  w = 4
) {
  console.log("COMPARING WITH", k, w);
  const tokenizer = new Tokenizer();

  // Tokenize and Fingerprint File 1
  const { tokens: tokens1, comments: comments1 } =
    tokenizer._tokenizeString(content1);
  const { kgramHashes: hashes1, fingerprints: fingerprints1 } =
    tokenizer._winnowing(tokens1, k, w); // fingerprints1 is Map<pos, Fingerprint>

  // Tokenize and Fingerprint File 2
  const { tokens: tokens2, comments: comments2 } =
    tokenizer._tokenizeString(content2);
  const { kgramHashes: hashes2, fingerprints: fingerprints2 } =
    tokenizer._winnowing(tokens2, k, w); // fingerprints2 is Map<pos, Fingerprint>

  // --- Direct Comparison Logic (adapted from reportSimilarity) ---

  // Find common fingerprints by hash value
  const commonFingerprints = new Map(); // Map<hashVal, {fp1, fp2}>
  for (const fp1 of hashes1.values()) {
    for (const fp2 of hashes2.values()) {
      // Using find to get the *first* match in fp2 for a given hash in fp1.
      // Adjust if multiple matches per hash are important.
      if (fp1.hashVal === fp2.hashVal) {
        if (!commonFingerprints.has(fp1.hashVal)) {
          // Store first pair found for this hash
          commonFingerprints.set(fp1.hashVal, { fp1, fp2 });
        }
        // break; // Optional: If you only want one match per fp1 hash
      }
    }
  }

  // Find common comments
  const commonCommentSet = new Set(
    [...comments1].filter((c) => comments2.has(c))
  );

  // Calculate similarity score
  const minFingerprintCount = Math.min(fingerprints1.size, fingerprints2.size);
  // Denominator definition from original Python code: min(len(fp1), len(fp2)) + len(common_comments)
  const denominator = minFingerprintCount + commonCommentSet.size;

  let similarityScore = 0;
  if (denominator > 0) {
    similarityScore =
      (commonFingerprints.size + commonCommentSet.size) / denominator;
  }

  // --- Generate Matches (LCS) ---
  const matches = [];
  if (commonFingerprints.size > 0) {
    for (const { fp1, fp2 } of commonFingerprints.values()) {
      // Get surrounding k-gram hashes (window size w around the fingerprint position)
      const start1 = Math.max(0, fp1.position - w);
      const end1 = Math.min(hashes1.length, fp1.position + w + 1);
      const surroundingHashes1 = hashes1.slice(start1, end1);

      const start2 = Math.max(0, fp2.position - w);
      const end2 = Math.min(hashes2.length, fp2.position + w + 1);
      const surroundingHashes2 = hashes2.slice(start2, end2);

      // Find LCS of surrounding hash sequences
      const { lcs1, lcs2 } = tokenizer.hashLcs(
        surroundingHashes1,
        surroundingHashes2
      );

      // Only add if LCS is non-empty
      if (lcs1.length > 0) {
        matches.push({
          ss: lcs1.map((hsh1) => hsh1.span), // Source spans
          ts: lcs2.map((hsh2) => hsh2.span), // Target spans
        });
      }
      // matches.push({
      //   ss: [fp1.span],
      //   ts: [fp2.span],
      // });
    }
  }

  // --- Return Report Object ---
  return {
    file1: name1,
    file2: name2,
    similarity_score: similarityScore,
    matches: matches,
    // Optionally include counts for debugging/info
    // file1_fingerprints: fingerprints1.size,
    // file2_fingerprints: fingerprints2.size,
    // common_fingerprints: commonFingerprints.size,
    // common_comments: commonCommentSet.size
  };
}

export { compareTwoFiles, Tokenizer, NormalizedTokenType }; // Export necessary parts
