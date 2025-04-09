from abc import ABC, abstractmethod
from controller.algorithms.abstract_NLP import abstract_NLP
import json
class abstract_similarity_score(ABC):
    @abstractmethod
    def score(data: json)->list[tuple[str,int]]:
        pass