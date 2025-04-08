from abc import ABC, abstractmethod
from controller.algorithms.abstract_tokenizer import abstract_tokenizer
from controller.algorithms.abstract_AST import abstract_AST
from controller.algorithms.abstract_model import abstract_model
import json


class abstract_NLP(ABC):
    @abstractmethod
    def combinedPredict(self, data, results) -> list[dict[str, float]]:
        pass