import os
import ast
import re
import math
import hashlib
import json
import tempfile
import zipfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from controller.algorithms.tokenization import tokenize_all_files

import numpy as np
import torch
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from transformers import RobertaTokenizer, RobertaModel, AutoTokenizer, AutoModel

# Device Configuration
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")


# ===========================
#  Token-Based Similarity
# ===========================
class TokenSimilarity:
    def __init__(self):
        self.vectorizer = CountVectorizer()

    def preprocess(self, code):
        """Preprocess code to normalize and replace variables for better token-based similarity."""
        # Remove comments and docstrings
        code = re.sub(
            r'(""".*?"""|\'\'\'.*?\'\'\'|#.*?$)', '',
            code,
            flags=re.MULTILINE | re.DOTALL
        )
        # Normalize whitespace
        code = re.sub(r'\s+', ' ', code).strip()
        # Replace variable and function names with generic placeholders
        tokens = re.findall(r'\b[a-zA-Z_]\w*\b', code)
        counts = Counter(tokens)
        replacements = {
            var: f"var_{i}"
            for i, (var, _) in enumerate(counts.items())
            if not self.is_keyword(var)
        }
        for var, replacement in replacements.items():
            code = re.sub(rf'\b{var}\b', replacement, code)
        return code

    def is_keyword(self, token):
        import keyword
        return token in keyword.kwlist

    def compute(self, code1, code2):
        """Compute token-based similarity after preprocessing."""
        code1 = self.preprocess(code1)
        code2 = self.preprocess(code2)
        vectors = self.vectorizer.fit_transform([code1, code2]).toarray()
        tensor1 = torch.tensor(vectors[0], dtype=torch.float32)
        tensor2 = torch.tensor(vectors[1], dtype=torch.float32)
        if torch.norm(tensor1) == 0 or torch.norm(tensor2) == 0:
            return 0.0
        cosine_sim = (tensor1 @ tensor2) / (torch.norm(tensor1) * torch.norm(tensor2))
        if torch.isnan(cosine_sim):
            return 0.0
        cosine_sim = torch.clamp(cosine_sim, 0.0, 1.0)
        if torch.isclose(cosine_sim, torch.tensor(1.0), atol=1e-6):
            return 1.0
        return cosine_sim.item()


# ===========================
#  AST-Based Similarity
# ===========================
class ASTSimilarity:
    def __init__(self):
        # Create a dictionary mapping AST node type names to integers
        self.nodetypedict = {node: i for i, node in enumerate(ast.__dict__.keys())}

    def create_adjacency_matrix(self, ast_tree):
        """Generate an adjacency matrix from an AST tree."""
        matrix_size = len(self.nodetypedict)
        matrix = np.zeros((matrix_size, matrix_size))

        def traverse(node, parent=None):
            if not isinstance(node, ast.AST):
                return
            current_type = self.nodetypedict.get(type(node).__name__, -1)
            parent_type = self.nodetypedict.get(type(parent).__name__, -1) if parent else -1
            if parent is not None and current_type >= 0 and parent_type >= 0:
                matrix[parent_type][current_type] += 1
            for child in ast.iter_child_nodes(node):
                traverse(child, parent=node)

        traverse(ast_tree)
        for row in range(matrix.shape[0]):
            total = matrix[row].sum()
            if total > 0:
                matrix[row] /= total
        return matrix

    def compute_similarity(self, matrix1, matrix2):
        """Compute cosine similarity between two matrices."""
        vec1 = matrix1.flatten().reshape(1, -1)
        vec2 = matrix2.flatten().reshape(1, -1)
        similarity = cosine_similarity(vec1, vec2)[0][0]
        return similarity

    def compute(self, code1, code2):
        """Compute AST similarity between two code snippets."""
        tree1 = ast.parse(code1)
        tree2 = ast.parse(code2)
        matrix1 = self.create_adjacency_matrix(tree1)
        matrix2 = self.create_adjacency_matrix(tree2)
        return float(self.compute_similarity(matrix1, matrix2))


# ===========================
#  Model-Based Similarity (RoBERTa or CodeBERT)
# ===========================
class EmbeddingSimilarity:
    def __init__(self, model_name="FacebookAI/roberta-base", batch_size=8):
        if "roberta" in model_name.lower():
            self.tokenizer = RobertaTokenizer.from_pretrained(model_name)
            self.model = RobertaModel.from_pretrained(model_name)
        else:
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModel.from_pretrained(model_name).to(device)
        self.embedding_cache = {}
        self.batch_size = batch_size

    def hash_code(self, code):
        """Generate a hash for the code snippet."""
        return hashlib.sha256(code.encode('utf-8')).hexdigest()

    def get_embedding(self, code_snippets):
        """Batch embedding generation with caching."""
        to_process = []
        embeddings = []

        for code in code_snippets:
            code_hash = self.hash_code(code)
            if code_hash in self.embedding_cache:
                embeddings.append(self.embedding_cache[code_hash])
            else:
                to_process.append(code)

        if to_process:
            for i in range(0, len(to_process), self.batch_size):
                batch = to_process[i: i + self.batch_size]
                inputs = self.tokenizer(
                    batch,
                    return_tensors="pt",
                    max_length=512,
                    truncation=True,
                    padding="max_length"
                )
                inputs = {key: val.to(device) for key, val in inputs.items()}

                with torch.no_grad():
                    outputs = self.model(**inputs)
                    batch_embeddings = outputs.last_hidden_state[:, 0, :]

                for j, embedding in enumerate(batch_embeddings):
                    code_hash = self.hash_code(batch[j])
                    self.embedding_cache[code_hash] = embedding
                    embeddings.append(embedding)

        return torch.stack(embeddings)

    def compute(self, code1, code2):
        """Compute cosine similarity between embeddings of two code snippets."""
        embeddings = self.get_embedding([code1, code2])
        embedding1, embedding2 = embeddings[0], embeddings[1]
        cosine_sim = torch.nn.functional.cosine_similarity(
            embedding1.unsqueeze(0), embedding2.unsqueeze(0)
        ).item()
        # Normalize cosine similarity
        normalized_embed_sim = max(0.0, min(1.0, (cosine_sim - 0.99) * 100))
        return 1 / (1 + math.exp(-9 * (normalized_embed_sim - 0.5)))


# ===========================
#  Code Similarity Pipeline
# ===========================
class CodeSimilarityPipeline:
    def __init__(self, model_name="microsoft/codebert-base"):
        self.token_sim = TokenSimilarity()
        self.ast_sim = ASTSimilarity()
        self.embed_sim = EmbeddingSimilarity(model_name)

    def compute_all(self, code1, code2):
        token_sim = self.token_sim.compute(code1, code2)
        ast_sim = self.ast_sim.compute(code1, code2)
        embed_sim = self.embed_sim.compute(code1, code2)
        return token_sim, ast_sim, embed_sim


# ===========================
#  Helper Functions
# ===========================
def extract_python_files_from_zip(zip_bytes):
    """
    Given the bytes of a zip file, extract all .py files and return a list of tuples:
      [(filename, file_content), ...]
    """
    python_files = []
    with tempfile.TemporaryDirectory() as tmpdirname:
        zip_path = os.path.join(tmpdirname, "upload.zip")
        with open(zip_path, "wb") as f:
            f.write(zip_bytes)
        with zipfile.ZipFile(zip_path, 'r') as zf:
            for info in zf.infolist():
                if info.filename.endswith(".py") and not info.is_dir():
                    with zf.open(info) as file:
                        content = file.read().decode("utf-8")
                        python_files.append((info.filename, content))
    return python_files


def compare_code_lines(code1_lines, code2_lines):
    """Compare lines between two files and return similarity scores."""
    # Use difflib to find matching lines
    import difflib
    matcher = difflib.SequenceMatcher(None, code1_lines, code2_lines)
    
    line_comparisons = []
    
    # Process each matching block
    for a, b, size in matcher.get_matching_blocks():
        if size > 0:
            for i in range(size):
                line1 = code1_lines[a + i]
                line2 = code2_lines[b + i]
                
                # Skip empty lines
                if not line1.strip() or not line2.strip():
                    continue
                
                # Compute similarity score for this line pair using token similarity
                # This is a simplified version - in a real implementation, you might use embeddings
                token_sim = TokenSimilarity().compute(line1, line2)
                
                # Only include if similarity is above threshold
                if token_sim > 0.7:  # Threshold for considering lines similar
                    line_comparisons.append({
                        "file1Line": line1,
                        "file2Line": line2,
                        "similarity": token_sim
                    })
    
    return line_comparisons

def compute_similarities_from_zip(zip_bytes, model_name="microsoft/codebert-base"):
    """
    Given a zip file (as bytes), extract Python files and compute pairwise similarity scores.
    Returns a list of dictionaries containing similarity results for each file pair.
    Also includes line-by-line comparison data for each file pair.
    """
    python_files = extract_python_files_from_zip(zip_bytes)
    file_pairs = []
    n = len(python_files)
    # Create all unique pairs (i < j)
    for i in range(n):
        for j in range(i + 1, n):
            file_pairs.append((python_files[i], python_files[j]))
    pipeline = CodeSimilarityPipeline(model_name)
    results = []
    file_contents = {}  # Store file contents for later use

    # Store all file contents
    for fname, content in python_files:
        file_contents[os.path.basename(fname)] = content

    # def process_pair(pair):
    #     (fname1, code1), (fname2, code2) = pair
    #     token_sim, ast_sim, embed_sim = pipeline.compute_all(code1, code2)
        
    #     # Compute line-by-line comparisons
    #     code1_lines = code1.splitlines()
    #     code2_lines = code2.splitlines()
    #     # FIXME!
    #     line_comparisons = compare_code_lines(code1_lines, code2_lines)
        
    #     return {
    #         "file1": fname1,
    #         "file2": fname2,
    #         "similarity_score": embed_sim,
    #         "line_comparisons": line_comparisons
    #     }

    # with ThreadPoolExecutor() as executor:
    #     for result in executor.map(process_pair, file_pairs):
    #         results.append(result)
    similarity_results_json, _ = tokenize_all_files(file_contents)

    # Add file contents to the results
    return {
        "similarity_results": similarity_results_json
    }
