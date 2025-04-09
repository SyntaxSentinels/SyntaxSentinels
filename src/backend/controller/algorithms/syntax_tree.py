import argparse
import ast
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from itertools import combinations


class ASTSimilarity:
    def __init__(self):
        # Create a dictionary mapping AST node type names to integers
        self.nodetypedict = {node: i for i, node in enumerate(ast.__dict__.keys())}

    def _create_adjacency_matrix(self, ast_tree):
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

    def _compute_similarity(self, matrix1, matrix2):
        """Compute cosine similarity between two matrices."""
        vec1 = matrix1.flatten().reshape(1, -1)
        vec2 = matrix2.flatten().reshape(1, -1)
        similarity = cosine_similarity(vec1, vec2)[0][0]
        return similarity
    
    def index_files(self, file_dict: dict[str, str]) -> dict[str, np.ndarray]:
        embeddings = {}
        for file_path, file_contents in file_dict.items():
            try:
                tree = ast.parse(file_contents, filename=file_path)
            except:
                tree = None
            matrix = self._create_adjacency_matrix(tree)
            vec = matrix.flatten().reshape(1, -1)
            embeddings[file_path] = vec
        return embeddings

    def report_similarity(self, file_paths: list[str], embeddings: dict[str, np.ndarray], min_percent: float) -> list[tuple[str, str, float]]:
        report = []
        for file1, file2 in combinations(file_paths, 2):
            matrix1 = embeddings[file1]
            matrix2 = embeddings[file2]
            similarity_score = self._compute_similarity(matrix1, matrix2)
            if similarity_score >= min_percent:
                report.append((file1, file2, similarity_score))
        return report


def parse_ast_all_files(file_dict: dict[str, str], m=0.0) -> list[tuple[str, str, float]]:
    similarity = ASTSimilarity()
    embeddings = similarity.index_files(file_dict)
    similarities = similarity.report_similarity(list(file_dict.keys()), embeddings, m)
    return similarities


def main():
    parser = argparse.ArgumentParser(description="Prototype for tokenization-based similarity scoring.")
    parser.add_argument('files', metavar='FILE', nargs='+', help='Python source files to process')
    parser.add_argument('--m', type=float, default=0.5, help='Minimum percentage of common fingerprints to report similarity (default: 0.5)')

    args = parser.parse_args()
    similarity = ASTSimilarity()

    embeddings = similarity.index_files(args.files)
    similarities = similarity.report_similarity(args.files, embeddings, args.m)
    
    for file1, file2, score in sorted(similarities, key=lambda x: -x[2]):
        print(f"{file1} {file2}:\n{score}")

if __name__ == '__main__':
    main()
