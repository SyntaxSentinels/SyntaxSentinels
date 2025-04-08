import re
from controller.algorithms.syntax_tree import *
from abc import ABC, abstractmethod
from controller.algorithms.abstract_NLP import abstract_NLP
import json

class vector_ast(ABC):

    def score(self, file_dict: dict[str, str], m=0.0) -> list[tuple[str, str, float]]:
        similarity = ASTSimilarity()
        embeddings = similarity.index_files(file_dict)
        similarities = similarity.report_similarity(list(file_dict.keys()), embeddings, m)
        return similarities

