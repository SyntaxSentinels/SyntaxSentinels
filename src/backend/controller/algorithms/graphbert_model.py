import torch
import numpy as np
from transformers import AutoTokenizer, AutoModel
import networkx as nx
from typing import List, Dict, Tuple, Any, Optional
import ast
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GraphBERTModel:
    """
    GraphBERT model for code similarity detection.
    Combines AST-based graph representations with BERT embeddings.
    """
    
    def __init__(self, model_name: str = "graphbert"):
        """
        Initialize the GraphBERT model.
        
        Args:
            model_name: The name of the model to use. Default is "graphbert".
        """
        self.model_name = model_name
        
        # Load the appropriate tokenizer and model based on model_name
        # For "graphbert", we use CodeBERT as the base model
        actual_model_name = "microsoft/codebert-base" if model_name == "graphbert" else model_name
        
        # Load the tokenizer and model
        self.tokenizer = AutoTokenizer.from_pretrained(actual_model_name)
        self.model = AutoModel.from_pretrained(actual_model_name)
            
        # Set device (GPU if available, otherwise CPU)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)
        
        logger.info(f"Initialized GraphBERT model with {model_name} on {self.device}")
    
    def parse_to_graph(self, code: str) -> nx.DiGraph:
        """
        Parse Python code into an Abstract Syntax Tree (AST) graph.
        
        Args:
            code: Python code as a string
            
        Returns:
            A NetworkX DiGraph representing the AST
        """
        try:
            # Parse the code into an AST
            tree = ast.parse(code)
            
            # Create a directed graph
            graph = nx.DiGraph()
            
            # Helper function to recursively build the graph
            def build_graph(node, parent_id=None):
                # Create a unique ID for this node
                node_id = id(node)
                
                # Add the node to the graph with its type as an attribute
                node_type = type(node).__name__
                graph.add_node(node_id, type=node_type)
                
                # If this node has a parent, add an edge from parent to this node
                if parent_id is not None:
                    graph.add_edge(parent_id, node_id)
                
                # Recursively process all child nodes
                for child_name, child_value in ast.iter_fields(node):
                    if isinstance(child_value, ast.AST):
                        # Single child node
                        build_graph(child_value, node_id)
                    elif isinstance(child_value, list):
                        # List of child nodes
                        for child_item in child_value:
                            if isinstance(child_item, ast.AST):
                                build_graph(child_item, node_id)
            
            # Start building the graph from the root node
            build_graph(tree)
            
            return graph
        
        except SyntaxError as e:
            logger.warning(f"Syntax error in code: {e}")
            # Return an empty graph for invalid code
            return nx.DiGraph()
    
    def get_code_embedding(self, code: str) -> np.ndarray:
        """
        Get the embedding for a code snippet using the BERT model.
        
        Args:
            code: Python code as a string
            
        Returns:
            A numpy array representing the code embedding
        """
        # Tokenize the code
        inputs = self.tokenizer(code, return_tensors="pt", truncation=True, 
                               max_length=512, padding="max_length")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        # Get the embedding
        with torch.no_grad():
            outputs = self.model(**inputs)
            
        # Use the [CLS] token embedding as the code representation
        embedding = outputs.last_hidden_state[:, 0, :].cpu().numpy()
        
        return embedding[0]  # Return as a 1D array
    
    def get_graph_embedding(self, graph: nx.DiGraph) -> np.ndarray:
        """
        Get an embedding for a graph representation of code.
        
        Args:
            graph: A NetworkX DiGraph representing the AST
            
        Returns:
            A numpy array representing the graph embedding
        """
        # Extract graph features
        num_nodes = graph.number_of_nodes()
        num_edges = graph.number_of_edges()
        
        if num_nodes == 0:
            # Return a zero vector for empty graphs
            return np.zeros(10)
        
        # Calculate basic graph metrics
        avg_degree = sum(dict(graph.degree()).values()) / num_nodes
        
        try:
            # These might fail for disconnected graphs
            diameter = nx.diameter(graph) if nx.is_connected(graph) else 0
            avg_shortest_path = nx.average_shortest_path_length(graph) if nx.is_connected(graph) else 0
        except (nx.NetworkXError, ZeroDivisionError):
            diameter = 0
            avg_shortest_path = 0
        
        # Count node types
        node_types = {}
        for node, attrs in graph.nodes(data=True):
            node_type = attrs.get('type', 'Unknown')
            node_types[node_type] = node_types.get(node_type, 0) + 1
        
        # Get the most common node types (up to 5)
        common_types = sorted(node_types.items(), key=lambda x: x[1], reverse=True)[:5]
        common_type_counts = [count for _, count in common_types]
        
        # Pad with zeros if needed
        common_type_counts = common_type_counts + [0] * (5 - len(common_type_counts))
        
        # Combine all features into a single vector
        features = np.array([
            num_nodes, 
            num_edges, 
            avg_degree, 
            diameter, 
            avg_shortest_path,
            *common_type_counts
        ])
        
        return features
    
    def compute_similarity(self, code1: str, code2: str) -> Dict[str, float]:
        """
        Compute the similarity between two code snippets.
        
        Args:
            code1: First Python code snippet
            code2: Second Python code snippet
            
        Returns:
            A dictionary with similarity scores
        """
        # Get BERT embeddings
        emb1 = self.get_code_embedding(code1)
        emb2 = self.get_code_embedding(code2)
        
        # Compute cosine similarity between embeddings
        embed_sim = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
        
        # Parse code to graphs
        graph1 = self.parse_to_graph(code1)
        graph2 = self.parse_to_graph(code2)
        
        # Get graph embeddings
        graph_emb1 = self.get_graph_embedding(graph1)
        graph_emb2 = self.get_graph_embedding(graph2)
        
        # Compute graph similarity
        if np.linalg.norm(graph_emb1) * np.linalg.norm(graph_emb2) > 0:
            graph_sim = np.dot(graph_emb1, graph_emb2) / (np.linalg.norm(graph_emb1) * np.linalg.norm(graph_emb2))
        else:
            graph_sim = 0.0
        
        # Compute token-based similarity
        tokens1 = set(self.tokenizer.tokenize(code1))
        tokens2 = set(self.tokenizer.tokenize(code2))
        
        if tokens1 and tokens2:
            token_sim = len(tokens1.intersection(tokens2)) / len(tokens1.union(tokens2))
        else:
            token_sim = 0.0
        
        # Combine similarities (weighted average)
        combined_sim = 0.5 * embed_sim + 0.3 * graph_sim + 0.2 * token_sim
        
        return {
            "similarity": float(combined_sim),
            "embedSim": float(embed_sim),
            "graphSim": float(graph_sim),
            "tokenSim": float(token_sim)
        }
    
    def compute_line_similarities(self, file1_lines: List[str], file2_lines: List[str]) -> List[Dict[str, Any]]:
        """
        Compute similarities between lines of two files.
        
        Args:
            file1_lines: List of code lines from the first file
            file2_lines: List of code lines from the second file
            
        Returns:
            A list of dictionaries with line comparison results
        """
        results = []
        
        # Filter out empty lines and comments
        def is_code_line(line: str) -> bool:
            line = line.strip()
            return line and not line.startswith('#')
        
        code_lines1 = [(i, line) for i, line in enumerate(file1_lines) if is_code_line(line)]
        code_lines2 = [(i, line) for i, line in enumerate(file2_lines) if is_code_line(line)]
        
        # Compare each line from file1 with each line from file2
        for i1, (line_num1, line1) in enumerate(code_lines1):
            for i2, (line_num2, line2) in enumerate(code_lines2):
                # Skip comparing identical line numbers in small files (likely boilerplate)
                if line_num1 == line_num2 and len(code_lines1) < 10 and len(code_lines2) < 10:
                    continue
                
                # Compute similarity
                sim_scores = self.compute_similarity(line1, line2)
                
                # Only include pairs with similarity above threshold
                if sim_scores["similarity"] > 0.7:
                    results.append({
                        "file1LineNum": line_num1,
                        "file2LineNum": line_num2,
                        "file1Line": line1,
                        "file2Line": line2,
                        "similarity": sim_scores["similarity"],
                        "embedSim": sim_scores["embedSim"],
                        "tokenSim": sim_scores["tokenSim"],
                        "graphSim": sim_scores["graphSim"]
                    })
        
        # Sort by similarity (descending)
        results.sort(key=lambda x: x["similarity"], reverse=True)
        
        return results
    
    def compute_file_similarity(self, file1_path: str, file2_path: str) -> Dict[str, Any]:
        """
        Compute similarity between two Python files.
        
        Args:
            file1_path: Path to the first Python file
            file2_path: Path to the second Python file
            
        Returns:
            A dictionary with similarity scores and line comparisons
        """
        try:
            # Read the files
            with open(file1_path, 'r', encoding='utf-8', errors='ignore') as f1:
                file1_content = f1.read()
                file1_lines = file1_content.splitlines()
            
            with open(file2_path, 'r', encoding='utf-8', errors='ignore') as f2:
                file2_content = f2.read()
                file2_lines = f2_content.splitlines()
            
            # Compute overall file similarity
            overall_sim = self.compute_similarity(file1_content, file2_content)
            
            # Compute line-by-line similarities
            line_comparisons = self.compute_line_similarities(file1_lines, file2_lines)
            
            return {
                "file1": file1_path,
                "file2": file2_path,
                "similarity_score": overall_sim["similarity"],
                "embedding_similarity": overall_sim["embedSim"],
                "graph_similarity": overall_sim["graphSim"],
                "token_similarity": overall_sim["tokenSim"],
                "line_comparisons": line_comparisons
            }
        
        except Exception as e:
            logger.error(f"Error computing file similarity: {e}")
            return {
                "file1": file1_path,
                "file2": file2_path,
                "similarity_score": 0.0,
                "error": str(e),
                "line_comparisons": []
            }
