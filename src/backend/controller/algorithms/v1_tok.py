import abstract_tokenizer
from tokenization import *

class MOSS_tok (abstract_tokenizer):
    def tokenize(file_dict: dict[str, str], k=5, w=4, m=0.0) -> list[dict]:
        tokenizer = Tokenizer()
        file_fingerprints, file_comments = tokenizer.index_files(file_dict, k=k, w=w)
        similarities = tokenizer.report_similarity(w, file_fingerprints, file_comments, min_common_percent=m)
        return similarities
