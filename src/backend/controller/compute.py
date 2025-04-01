import os
import ast
import re
import math
import hashlib
import sys
import json
from lib2to3 import refactor
import tempfile
import zipfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import autopep8

import numpy as np
import torch
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from transformers import RobertaTokenizer, RobertaModel, AutoTokenizer, AutoModel

# Device Configuration
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")


def fix_python2_to_python3(code):
    # Replace Python 2 print statement with Python 3 print function
    # Match print without parentheses immediately after it
    pattern = r'print(?!\()(\s*)(?!\w)(.*)'

    # Replacement will wrap the matched part (arguments) in parentheses
    # Wrap the arguments (captured by (.*)) in parentheses
    replacement = r'print(\2)'

    # Use re.sub to replace the print statements in the code
    code = re.sub(pattern, replacement, code)

    # Convert exception syntax
    code = code.replace("except Exception, e:", "except Exception as e:")

    code = code.replace("xrange", "range")

    try_pattern = r'(try:\s*.*?)(?=\s*(finally|$))'

    # Function to add the except block after the try block content
    def add_except_block(match):
        # The content inside the try block
        try_content = match.group(1)

        # Check if there is already an except block in the code
        if "except" not in try_content.lower():  # Case insensitive check for `except`
            # Add the except block after the try content
            return f"{try_content}\n    except Exception as e: pass"
        else:
            # If except already exists, do not modify
            return try_content

    # Replace all occurrences of try blocks without except
    code = re.sub(try_pattern, add_except_block, code, flags=re.DOTALL)
    # code = "\n".join(line.strip().rstrip(' ') for line in code.splitlines())
    return code

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
        self.count = 0
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

    def compute(self, matrix1, matrix2):
        self.count += 1
        """Compute AST similarity between two code snippets."""
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

    def compute(self, embedding1, embedding2):
        """Compute cosine similarity between embeddings of two code snippets."""
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

    def compute_all(self, matrix_pair, token_pair, embedding_pair):
        token_sim = self.token_sim.compute(token_pair[0], token_pair[1])
        ast_sim = self.ast_sim.compute_similarity(matrix_pair[0], matrix_pair[1])
        embed_sim = self.embed_sim.compute(embedding_pair[0], embedding_pair[1])
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


def compute_similarities_from_zip(zip_bytes, model_name="microsoft/codebert-base"):
    """
    Given a zip file (as bytes), extract Python files and compute pairwise similarity scores.
    Returns a list of dictionaries containing similarity results for each file pair.
    """
    python_files = extract_python_files_from_zip(zip_bytes)

    token_sim = TokenSimilarity()
    ast_sim = ASTSimilarity()
    nlp_sim = EmbeddingSimilarity()

    file_pairs = []
    matrices = []
    tokens = []
    embeddings = []
    count = 0
    batch = [file[1] for file in python_files]
    inputs = nlp_sim.tokenizer(
        batch,
        return_tensors="pt",
        max_length=512,
        truncation=True,
        padding="max_length"
    )
    inputs = {key: val.to(device) for key, val in inputs.items()}

    with torch.no_grad():
        outputs = nlp_sim.model(**inputs)
        batch_embeddings = outputs.last_hidden_state[:, 0, :]

    for j, embedding in enumerate(batch_embeddings):
        embeddings.append(embedding)

    for i in range(len(python_files)):
        count += 1
        try:
            tree = ast.parse(python_files[i][1])
        except Exception as e:
            tree = ast.parse(autopep8.fix_code(fix_python2_to_python3(python_files[i][1])))

        matrices.append(ast_sim.create_adjacency_matrix(tree))
        tokens.append(token_sim.preprocess(python_files[i][1]))
    n = len(python_files)
    # Create all unique pairs (i < j)
    for i in range(n):
        for j in range(i + 1, n):
            file_pairs.append((python_files[i][0], python_files[j][0], [matrices[i], matrices[j]], [tokens[i], tokens[j]], [embeddings[i], embeddings[j]]))
    pipeline = CodeSimilarityPipeline(model_name)
    results = []

    def process_pair(pair):
        fname1, fname2, matrix_pair, token_pair, embedding_pair = pair
        token_sim, ast_sim, embed_sim = pipeline.compute_all(matrix_pair, token_pair, embedding_pair)
        return {
            "file1": fname1,
            "file2": fname2,
            "similarity_score": 1.0 * embed_sim + 0.0 * ast_sim + 0.0 * token_sim
        }

    with ThreadPoolExecutor() as executor:
        for result in executor.map(process_pair, file_pairs):
            results.append(result)

    # Add file contents to the results
    return {
        "similarity_results": results
    }
