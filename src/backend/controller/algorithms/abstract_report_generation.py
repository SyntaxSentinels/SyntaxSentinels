from abc import ABC, abstractmethod
import json
from controller.algorithms.abstract_similarity_score import abstract_similarity_score

class abstract_report_generation(ABC):
    @abstractmethod
    def generate(data: json) -> json:
        pass
