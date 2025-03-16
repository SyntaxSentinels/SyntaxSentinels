import re
import hashlib
import numpy as np
from typing import List, Dict, Tuple, Set, Any
from collections import defaultdict
import torch
from transformers import AutoTokenizer, AutoModel

class PrivacyPreservingComparison:
    """
    A privacy-preserving code comparison system inspired by plagiarism detection tools like Dolos.
    Uses tokenization, fingerprinting, and indexing without storing the original source code.
    """
    
    def __init__(self, model_name="microsoft/codebert-base", device=None):
        """
        Initialize the comparison system with a model for embedding generation.
        
        Args:
            model_name: The name of the model to use for embeddings
            device: The device to use for computation (CPU or CUDA)
        """
        self.model_name = model_name
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Initialize tokenizer and model
        # For "graphbert", we use CodeBERT as the base model
        actual_model_name = "microsoft/codebert-base" if model_name == "graphbert" else model_name
        
        # Load the tokenizer and model
        self.tokenizer = AutoTokenizer.from_pretrained(actual_model_name)
        self.model = AutoModel.from_pretrained(actual_model_name).to(self.device)
        
        # Parameters for fingerprinting
        self.k_gram_size = 5  # Size of k-grams for fingerprinting
        self.window_size = 4  # Window size for winnowing algorithm
        
        # Cache for embeddings and fingerprints
        self.embedding_cache = {}
        self.fingerprint_cache = {}
    
    def tokenize_code(self, code: str) -> List[str]:
        """
        Tokenize code into a list of meaningful tokens.
        
        Args:
            code: The code to tokenize
            
        Returns:
            A list of tokens
        """
        # Remove comments
        code = re.sub(r'#.*$', '', code, flags=re.MULTILINE)
        code = re.sub(r'""".*?"""', '', code, flags=re.DOTALL)
        code = re.sub(r"'''.*?'''", '', code, flags=re.DOTALL)
        
        # Tokenize based on Python syntax
        tokens = []
        
        # Split by common delimiters while preserving them
        pattern = r'(\s+|[{}()\[\]:;,.\-+*/&|^=<>!])'
        parts = re.split(pattern, code)
        
        # Filter out empty strings and whitespace
        tokens = [part for part in parts if part and not part.isspace()]
        
        return tokens
    
    def normalize_tokens(self, tokens: List[str]) -> List[str]:
        """
        Normalize tokens to reduce false negatives.
        
        Args:
            tokens: List of tokens to normalize
            
        Returns:
            Normalized tokens
        """
        # Replace variable names with placeholders
        var_map = {}
        normalized = []
        
        for token in tokens:
            # Check if token is a potential variable name
            if re.match(r'^[a-zA-Z_]\w*$', token):
                # Skip Python keywords
                if token in {"if", "else", "elif", "for", "while", "def", "class", 
                            "return", "import", "from", "as", "try", "except", 
                            "finally", "with", "lambda", "None", "True", "False"}:
                    normalized.append(token)
                else:
                    # Replace with a placeholder
                    if token not in var_map:
                        var_map[token] = f"VAR_{len(var_map)}"
                    normalized.append(var_map[token])
            else:
                normalized.append(token)
        
        return normalized
    
    def create_fingerprint(self, tokens: List[str]) -> List[int]:
        """
        Create a fingerprint from tokens using k-grams and winnowing.
        
        Args:
            tokens: The tokens to fingerprint
            
        Returns:
            A list of hash values representing the fingerprint
        """
        # Generate k-grams
        k_grams = []
        for i in range(len(tokens) - self.k_gram_size + 1):
            k_gram = ' '.join(tokens[i:i + self.k_gram_size])
            k_grams.append(k_gram)
        
        # Hash each k-gram
        hashes = []
        for k_gram in k_grams:
            hash_value = int(hashlib.md5(k_gram.encode()).hexdigest(), 16) % (2**32)
            hashes.append(hash_value)
        
        # Apply winnowing algorithm
        if len(hashes) <= self.window_size:
            return hashes
        
        fingerprint = []
        for i in range(len(hashes) - self.window_size + 1):
            window = hashes[i:i + self.window_size]
            min_hash = min(window)
            min_pos = i + window.index(min_hash)
            
            # Only add if it's a new position
            if not fingerprint or min_pos > fingerprint[-1][1]:
                fingerprint.append((min_hash, min_pos))
        
        # Extract just the hash values
        return [h for h, _ in fingerprint]
    
    def get_embedding(self, code: str) -> torch.Tensor:
        """
        Generate an embedding for a code snippet.
        
        Args:
            code: The code to embed
            
        Returns:
            A tensor representing the code embedding
        """
        # Check cache first
        code_hash = hashlib.md5(code.encode()).hexdigest()
        if code_hash in self.embedding_cache:
            return self.embedding_cache[code_hash]
        
        # Tokenize for the model
        inputs = self.tokenizer(
            code, 
            return_tensors="pt", 
            max_length=512, 
            truncation=True, 
            padding="max_length"
        )
        inputs = {key: val.to(self.device) for key, val in inputs.items()}
        
        # Generate embedding
        with torch.no_grad():
            outputs = self.model(**inputs)
            embedding = outputs.last_hidden_state[:, 0, :]  # CLS token embedding
        
        # Cache and return
        self.embedding_cache[code_hash] = embedding
        return embedding
    
    def compare_lines(self, line1: str, line2: str) -> Dict[str, Any]:
        """
        Compare two lines of code using multiple techniques.
        
        Args:
            line1: First line of code
            line2: Second line of code
            
        Returns:
            A dictionary with similarity scores and details
        """
        # Skip empty lines
        if not line1.strip() or not line2.strip():
            return {"similarity": 0.0, "token_sim": 0.0, "embed_sim": 0.0, "fingerprint_sim": 0.0}
        
        # Tokenize
        tokens1 = self.tokenize_code(line1)
        tokens2 = self.tokenize_code(line2)
        
        # Normalize
        norm_tokens1 = self.normalize_tokens(tokens1)
        norm_tokens2 = self.normalize_tokens(tokens2)
        
        # Create fingerprints
        fp1 = self.create_fingerprint(norm_tokens1)
        fp2 = self.create_fingerprint(norm_tokens2)
        
        # Calculate token-based similarity (Jaccard)
        token_sim = self._jaccard_similarity(set(norm_tokens1), set(norm_tokens2))
        
        # Calculate fingerprint similarity
        fingerprint_sim = self._jaccard_similarity(set(fp1), set(fp2))
        
        # Calculate embedding similarity
        embed1 = self.get_embedding(line1)
        embed2 = self.get_embedding(line2)
        embed_sim = torch.nn.functional.cosine_similarity(embed1, embed2).item()
        
        # Combine similarities with weights
        combined_sim = 0.3 * token_sim + 0.3 * fingerprint_sim + 0.4 * embed_sim
        
        return {
            "similarity": combined_sim,
            "token_sim": token_sim,
            "embed_sim": embed_sim,
            "fingerprint_sim": fingerprint_sim
        }
    
    def compare_files(self, file1_lines: List[str], file2_lines: List[str], threshold: float = 0.6) -> List[Dict[str, Any]]:
        """
        Compare two files line by line.
        
        Args:
            file1_lines: Lines from the first file
            file2_lines: Lines from the second file
            threshold: Minimum similarity threshold to include in results
            
        Returns:
            A list of dictionaries with line comparison results
        """
        import difflib
        
        # Use difflib to find matching line blocks
        matcher = difflib.SequenceMatcher(None, file1_lines, file2_lines)
        
        comparisons = []
        
        # Process each matching block
        for a, b, size in matcher.get_matching_blocks():
            if size > 0:
                for i in range(size):
                    line1 = file1_lines[a + i]
                    line2 = file2_lines[b + i]
                    
                    # Skip empty lines
                    if not line1.strip() or not line2.strip():
                        continue
                    
                    # Compare the lines
                    result = self.compare_lines(line1, line2)
                    
                    # Only include if similarity is above threshold
                    if result["similarity"] > threshold:
                        comparisons.append({
                            "file1_line_num": a + i,
                            "file2_line_num": b + i,
                            "file1_line": self._hash_line(line1),  # Store hash instead of actual line
                            "file2_line": self._hash_line(line2),  # Store hash instead of actual line
                            "similarity": result["similarity"],
                            "token_sim": result["token_sim"],
                            "embed_sim": result["embed_sim"],
                            "fingerprint_sim": result["fingerprint_sim"]
                        })
        
        return comparisons
    
    def _jaccard_similarity(self, set1: Set, set2: Set) -> float:
        """
        Calculate Jaccard similarity between two sets.
        
        Args:
            set1: First set
            set2: Second set
            
        Returns:
            Jaccard similarity (intersection over union)
        """
        if not set1 or not set2:
            return 0.0
        
        intersection = len(set1.intersection(set2))
        union = len(set1.union(set2))
        
        return intersection / union if union > 0 else 0.0
    
    def _hash_line(self, line: str) -> str:
        """
        Create a hash of a line to avoid storing the actual code.
        
        Args:
            line: The line to hash
            
        Returns:
            A hash string representing the line
        """
        return hashlib.sha256(line.encode()).hexdigest()


class DolosStyleComparison:
    """
    A more comprehensive code comparison system inspired by Dolos plagiarism detection.
    Combines multiple techniques for accurate detection while preserving privacy.
    """
    
    def __init__(self, model_name="microsoft/codebert-base"):
        """Initialize the comparison system."""
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.comparison = PrivacyPreservingComparison(model_name, self.device)
    
    def compare_files(self, file1_content: str, file2_content: str) -> Dict[str, Any]:
        """
        Compare two files and generate a comprehensive similarity report.
        
        Args:
            file1_content: Content of the first file
            file2_content: Content of the second file
            
        Returns:
            A dictionary with similarity metrics and line-by-line comparisons
        """
        # Split into lines
        file1_lines = file1_content.splitlines()
        file2_lines = file2_content.splitlines()
        
        # Get line-by-line comparisons
        line_comparisons = self.comparison.compare_files(file1_lines, file2_lines)
        
        # Calculate overall similarity
        if line_comparisons:
            overall_similarity = sum(comp["similarity"] for comp in line_comparisons) / len(line_comparisons)
        else:
            overall_similarity = 0.0
        
        # Calculate coverage (percentage of lines with matches)
        file1_matched_lines = set(comp["file1_line_num"] for comp in line_comparisons)
        file2_matched_lines = set(comp["file2_line_num"] for comp in line_comparisons)
        
        file1_coverage = len(file1_matched_lines) / len(file1_lines) if file1_lines else 0
        file2_coverage = len(file2_matched_lines) / len(file2_lines) if file2_lines else 0
        
        # Generate heatmap data (line numbers and similarity scores)
        heatmap_data = [
            {
                "file1_line": comp["file1_line_num"],
                "file2_line": comp["file2_line_num"],
                "similarity": comp["similarity"]
            }
            for comp in line_comparisons
        ]
        
        # Return comprehensive report
        return {
            "overall_similarity": overall_similarity,
            "file1_coverage": file1_coverage,
            "file2_coverage": file2_coverage,
            "line_comparisons": line_comparisons,
            "heatmap_data": heatmap_data,
            "file1_line_count": len(file1_lines),
            "file2_line_count": len(file2_lines),
            "matched_line_count": len(line_comparisons)
        }
