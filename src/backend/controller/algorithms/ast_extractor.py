import ast
import networkx as nx
import numpy as np
from typing import Dict, List, Tuple, Any, Optional

class ASTExtractor:
    """
    Utility class to extract Abstract Syntax Tree (AST) information from Python code.
    This information can be used by GraphBERT to incorporate structural information.
    """
    
    def __init__(self):
        """Initialize the AST extractor."""
        self.node_counter = 0
        self.node_map = {}  # Maps AST nodes to indices
    
    def reset(self):
        """Reset the node counter and map."""
        self.node_counter = 0
        self.node_map = {}
    
    def extract_ast_data(self, code: str) -> Dict[str, Any]:
        """
        Extract AST data from the given code.
        
        Args:
            code: Python code as a string
            
        Returns:
            A dictionary containing AST information:
                - nodes: List of node types
                - edges: List of (source, target) tuples representing edges
                - node_features: Matrix of node features
        """
        self.reset()
        
        try:
            # Parse the code into an AST
            tree = ast.parse(code)
            
            # Create a graph from the AST
            graph = nx.DiGraph()
            
            # Traverse the AST and build the graph
            self._traverse_ast(tree, graph)
            
            # Extract nodes and edges
            nodes = list(graph.nodes())
            edges = list(graph.edges())
            
            # Create node features (one-hot encoding of node types)
            node_types = [graph.nodes[node]['type'] for node in nodes]
            unique_types = list(set(node_types))
            type_to_idx = {t: i for i, t in enumerate(unique_types)}
            
            # Create one-hot encoded features
            node_features = np.zeros((len(nodes), len(unique_types)))
            for i, node_type in enumerate(node_types):
                node_features[i, type_to_idx[node_type]] = 1
            
            return {
                'nodes': nodes,
                'node_types': node_types,
                'edges': edges,
                'node_features': node_features.tolist(),
                'type_to_idx': type_to_idx
            }
            
        except SyntaxError:
            # Return empty data if code has syntax errors
            return {
                'nodes': [],
                'node_types': [],
                'edges': [],
                'node_features': [],
                'type_to_idx': {}
            }
    
    def _traverse_ast(self, node: ast.AST, graph: nx.DiGraph, parent: Optional[int] = None) -> int:
        """
        Recursively traverse the AST and build a graph.
        
        Args:
            node: The current AST node
            graph: The graph to build
            parent: The parent node index (if any)
            
        Returns:
            The index of the current node
        """
        # Skip if not an AST node
        if not isinstance(node, ast.AST):
            return None
        
        # Get node type
        node_type = type(node).__name__
        
        # Assign an index to this node
        node_idx = self.node_counter
        self.node_map[node] = node_idx
        self.node_counter += 1
        
        # Add node to graph with its type as an attribute
        graph.add_node(node_idx, type=node_type)
        
        # Connect to parent if exists
        if parent is not None:
            graph.add_edge(parent, node_idx)
        
        # Recursively process all children
        for child_name, child in ast.iter_fields(node):
            if isinstance(child, list):
                # If child is a list (e.g., body of a function), process each item
                for item in child:
                    child_idx = self._traverse_ast(item, graph, node_idx)
            else:
                # Process single child
                child_idx = self._traverse_ast(child, graph, node_idx)
        
        return node_idx
    
    def get_ast_features_for_tokenized_code(self, code: str, tokenizer, max_length: int = 512) -> Dict[str, Any]:
        """
        Extract AST features and align them with tokenized code.
        This is useful for models that need both token and AST information.
        
        Args:
            code: Python code as a string
            tokenizer: The tokenizer to use
            max_length: Maximum sequence length
            
        Returns:
            A dictionary containing tokenized inputs and AST information
        """
        # Tokenize the code
        inputs = tokenizer(
            code,
            return_tensors="pt",
            max_length=max_length,
            truncation=True,
            padding="max_length"
        )
        
        # Extract AST data
        ast_data = self.extract_ast_data(code)
        
        # Combine tokenized inputs and AST data
        result = {
            **inputs,
            'ast_data': ast_data
        }
        
        return result
