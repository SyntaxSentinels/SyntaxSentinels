from abc import ABC, abstractmethod


class abstract_tokenizer(ABC): #tokenizeError
    @abstractmethod
    def tokenize(source: str) -> list[int]:
        pass