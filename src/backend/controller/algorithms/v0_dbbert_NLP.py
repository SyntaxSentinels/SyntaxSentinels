from abstract_NLP import abstract_NLP
from v0_roberta_tokenizer import roberta_tokenizer as tok
from v0_codebert_model import codebert_model as b_model
from v0_dbscan_model import dbscan_model as d_model
import json
import numpy as np

class dbbert_NLP(abstract_NLP):
    def combinedPredict(data):
        embedder = b_model()
        clusterer = d_model()
        snippets = data

        embeddings = np.array(

            [embedder.predict(tok.tokenize(snippet))['embedding']
             for snippet in snippets]
        )

        print(embeddings)
        clusters = clusterer.predict(embeddings)
        
        combined_prediction = {'embeddings': embeddings, 'clusters': clusters}

        return combined_prediction

