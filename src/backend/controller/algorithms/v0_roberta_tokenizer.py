from controller.algorithms.abstract_tokenizer import abstract_tokenizer
from transformers import RobertaTokenizer

class roberta_tokenizer(abstract_tokenizer):
    def tokenize(source):
        tokenizer = RobertaTokenizer.from_pretrained('microsoft/codebert-base')
        tokens = tokenizer(source, return_tensors = "pt", truncation=True, padding=True)
        return tokens
