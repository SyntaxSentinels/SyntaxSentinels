#!/usr/bin/env python3
from enum import Enum
import sys
import json
import argparse
import tokenize
from itertools import combinations
from dataclasses import dataclass
import os
import io

@dataclass
class Fingerprint:
    hash_val: int
    position: int
    span: dict


class NormalizedTokenType(Enum):
    IDENTIFIER = 0
    NUMERIC_LITERAL = 1
    STRING_LITERAL = 2

@dataclass
class Token:
    start_pos: tuple[int, int]
    end_pos: tuple[int, int]
    value: str | NormalizedTokenType


class Tokenizer:
    def _normalize_token(self, tok_type, tok_string):
        # Token types from the built-in tokenize module
        if tok_type == tokenize.NAME:
            # Use the keyword module to check if the token is a keyword.
            import keyword
            if keyword.iskeyword(tok_string):
                return tok_string
            else:
                return NormalizedTokenType.IDENTIFIER
                # return tok_string.strip()
        elif tok_type == tokenize.NUMBER:
            return NormalizedTokenType.NUMERIC_LITERAL
        elif tok_type == tokenize.STRING:
            return NormalizedTokenType.STRING_LITERAL
        elif tok_type in (tokenize.NEWLINE, tokenize.NL, tokenize.ENCODING):
            return ""
        else:
            return tok_string.strip()


    def _hash_token(self, token: Token) -> int:
        if isinstance(token.value, NormalizedTokenType):
            return token.value.value
        assert isinstance(token.value, str)
        BASE = 747287
        MOD = 33554393
        hsh = 0
        for ch in token.value:
            hsh = ((hsh + ord(ch)) * BASE) % MOD
        return hsh


    def _tokenize_file(self, file_contents: str) -> tuple[list[Token], set[str]]:
        """
        Tokenizes the given Python file and returns a list of token strings.
        """
        comments = set()
        tokens = []
        try:
            readline_func = io.StringIO(file_contents).readline
            token_generator = tokenize.generate_tokens(readline_func)
            for tok in token_generator:
                # Ignore tokens we don't care about.
                if tok.type == tokenize.COMMENT:
                    # Handle comments specially, we want to check for lazy exact matches
                    comments.add(tok.string)
                if tok.type in (tokenize.COMMENT, tokenize.NL, tokenize.NEWLINE, tokenize.ENCODING):
                    continue
                normalized = self._normalize_token(tok.type, tok.string)

                if normalized != "":
                    tokens.append(Token(tok.start, tok.end, normalized))
        except Exception as e:
            print(f"Error tokenizing file: {e}", file=sys.stderr)

        return tokens, comments


    def _compute_rolling_hashes(self, tokens: list[Token], k: int) -> list[Fingerprint]:
        """
        Computes a list of rolling hash values for all k-grams in the token list. 
        The hash for a k-gram is computed using Rabin-Karp.
        
        Returns a list of Fingerprint(hash_val, position, span) for each k-gram starting at index position.
        """
        n = len(tokens)
        if n < k:
            return []

        BASE = 4194301
        MOD = 33554393

        hashes = []
        high_order = pow(BASE, k - 1, MOD)
        
        h = 0
        for i in range(k):
            token_val = self._hash_token(tokens[i])
            h = (h * BASE + token_val) % MOD
        
        first_span = {
            'sl': tokens[0].start_pos[0],
            'sc': tokens[0].start_pos[1]+1,
            'el': tokens[k-1].end_pos[0],
            'ec': tokens[k-1].end_pos[1]+1,
        }
        hashes.append(Fingerprint(hash_val=h, position=0, span=first_span))
        
        for i in range(1, n - k + 1):
            left_token_val = self._hash_token(tokens[i - 1])
            h = (h - left_token_val * high_order) % MOD
            h = (h * BASE + self._hash_token(tokens[i + k - 1])) % MOD
            
            span = {
                'sl': tokens[i].start_pos[0],
                'sc': tokens[i].start_pos[1]+1,
                'el': tokens[i+k-1].end_pos[0],
                'ec': tokens[i+k-1].end_pos[1]+1,
            }
            hashes.append(Fingerprint(hash_val=h, position=i, span=span))

        return hashes


    def _winnowing(self, tokens: list[Token], k: int, w: int) -> tuple[list[Fingerprint], dict[int, Fingerprint]]:
        """
        Implements the winnowing algorithm with a Rabin-Karp rolling hash.
        
        1. Computes rolling hash values over all k-grams.
        2. Slides a window of size w over the list of k-gram hashes and records the minimal hash in that window.
        
        Returns a dictionary mapping the starting position (index of the k-gram) to the Fingerprint.
        """
        kgram_hashes = self._compute_rolling_hashes(tokens, k)
        n = len(kgram_hashes)
        fingerprints: dict[int, Fingerprint] = {}
        
        if n == 0:
            return kgram_hashes, fingerprints
        
        if n < w:
            # If there are fewer than w hashes, choose the minimal one.
            min_fp = min(kgram_hashes, key=lambda fp: fp.hash_val)
            fingerprints[min_fp.position] = min_fp
        else:
            # Slide a window over the k-gram hashes.
            for i in range(n - w + 1):
                window = kgram_hashes[i:i+w]
                min_fp = min(window, key=lambda fp: fp.hash_val)
                fingerprints[min_fp.position] = min_fp
        return kgram_hashes, fingerprints


    def index_files(self, file_dict: dict[str, str], k: int, w: int) -> tuple[dict[str, tuple[list[Fingerprint], dict[int, Fingerprint]]], dict[str, set[str]]]:
        """
        Processes each file: tokenizes, fingerprints, and then builds an index of fingerprints.
        
        Returns:
        - file_fingerprints_and_hashes: dict mapping file_path to its dict of fingerprint values
        - file_comments
        """
        file_fingerprints_and_hashes: dict[str, tuple[list[Fingerprint], dict[int, Fingerprint]]] = {}
        file_comments = {}

        for file_path, file_contents in file_dict.items():
            tokens, comments = self._tokenize_file(file_contents)
            hashes, fingerprints = self._winnowing(tokens, k, w)
            file_fingerprints_and_hashes[file_path] = hashes, fingerprints
            file_comments[file_path] = comments
        return file_fingerprints_and_hashes, file_comments


    def hash_lcs(self, seq1: list[Fingerprint], seq2: list[Fingerprint]):
        """
        Find the Longest Common Subsequence (LCS) between two sequences of hashes.
        """
        m, n = len(seq1), len(seq2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if seq1[i-1].hash_val == seq2[j-1].hash_val:
                    dp[i][j] = dp[i-1][j-1] + 1
                else:
                    dp[i][j] = max(dp[i-1][j], dp[i][j-1])
        
        # Reconstruct
        lcs1 = []
        lcs2 = []
        i, j = m, n
        while i > 0 and j > 0:
            if seq1[i-1].hash_val == seq2[j-1].hash_val:
                lcs1.append(seq1[i-1])
                lcs2.append(seq2[j-1])
                i -= 1
                j -= 1
            elif dp[i-1][j] > dp[i][j-1]:
                i -= 1
            else:
                j -= 1
        
        return lcs1[::-1], lcs2[::-1]


    def report_similarity(self, w: int,
                           file_fingerprints_and_hashes: dict[str, tuple[list[Fingerprint], dict[int, Fingerprint]]],
                           file_comments: dict[str, set[str]],
                           min_common_percent: float) -> list[dict]:
        """
        Compares the fingerprint sets from each file pair and reports those with at least
        min_common shared fingerprints.
        """
        report = []
        files = list(file_fingerprints_and_hashes.keys())
        file_hashes = {k: v[0] for k, v in file_fingerprints_and_hashes.items()}
        file_fingerprints = {k: v[1] for k, v in file_fingerprints_and_hashes.items()}
        for file1, file2 in combinations(files, 2):
            # Find common fingerprints
            common_fingerprints = {}
            for _, fp1 in file_fingerprints[file1].items():
                for _, fp2 in file_fingerprints[file2].items():
                    if fp1.hash_val == fp2.hash_val:
                        common_fingerprints[fp1.hash_val] = (fp1, fp2)

            # Calculate similarity
            min_fingerprints = min(len(file_fingerprints[file1]), len(file_fingerprints[file2]))
            common_comments = file_comments[file1] & file_comments[file2]
            denominator = min_fingerprints + len(common_comments)
            
            if denominator > 0:
                similarity_score = (len(common_fingerprints) + len(common_comments)) / denominator
            else:
                similarity_score = 0

            if similarity_score >= min_common_percent:
                # Prepare matches
                matches = []
                for (_, (fp1, fp2)) in common_fingerprints.items():
                    surrounding_hashes1 = [file_hashes[file1][i] for i in range(max(0, fp1.position-w), min(len(file_hashes[file1]), fp1.position+w+1))]
                    surrounding_hashes2 = [file_hashes[file2][i] for i in range(max(0, fp2.position-w), min(len(file_hashes[file2]), fp2.position+w+1))]
                    lcs1, lcs2 = self.hash_lcs(surrounding_hashes1, surrounding_hashes2)
                    matches.append({
                        'ss': [hsh1.span for hsh1 in lcs1],
                        'ts': [hsh2.span for hsh2 in lcs2],
                    })

                # Create report entry
                report.append({
                    'file1': os.path.basename(file1),
                    'file2': os.path.basename(file2),
                    'similarity_score': similarity_score,
                    'matches': matches,
                })
        
        return report


def tokenize_all_files(file_dict, k=7, w=5, m=0.0):
    tokenizer = Tokenizer()
    file_fingerprints, file_comments = tokenizer.index_files(file_dict, k=k, w=w)
    
    similarities = tokenizer.report_similarity(w, file_fingerprints, file_comments, min_common_percent=m)
    similarities_json = json.dumps(similarities, separators=(',', ':'))
    file_contents_json = json.dumps(file_dict, separators=(',', ':'))
    return similarities_json, file_contents_json


def main():
    parser = argparse.ArgumentParser(description="Tokenization-based similarity scoring with span tracking.")
    parser.add_argument('files', metavar='FILE', nargs='+', help='Python source files to process')
    parser.add_argument('--k', type=int, default=7, help='k-gram size for fingerprinting (default: 7)')
    parser.add_argument('--w', type=int, default=4, help='Window size for winnowing (default: 4)')
    parser.add_argument('--m', type=float, default=0.5, help='Minimum percentage of common fingerprints to report similarity (default: 0.5)')
    
    args = parser.parse_args()
    file_dict = {}
    for filename in args.files:
        with open(filename, "r") as f:
            file_dict[filename] = f.read()
    similarity_scores, file_contents = tokenize_all_files(file_dict, k=args.k, w=args.w, m=args.m)

    with open("similarity_scores.json", "w") as f:
        print(similarity_scores, file=f)
    with open("file_contents.json", "w") as f:
        print(file_contents, file=f)


if __name__ == '__main__':
    main()