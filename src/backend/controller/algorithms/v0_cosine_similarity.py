from controller.algorithms.abstract_similarity_score import abstract_similarity_score
from controller.algorithms.v0_dbbert_NLP import dbbert_NLP as nlp
from sklearn.metrics.pairwise import cosine_similarity as cos_sim
import numpy as np

class cosine_similarity(abstract_similarity_score):

    def score(data):
        snippets = data['snippets']
        threshold = data['threshold']*3 #convert to deviation 

        combined_predictions = nlp.combinedPredict(snippets)
        embeddings = combined_predictions['embeddings']
        clusters = combined_predictions['clusters']
        n = len(embeddings)
        similarity_matrix = np.zeros((n, n))

        for i in range(n):
            for j in range(i+1, n):
                if clusters[i] == clusters[j]:  
                    similarity = cos_sim([embeddings[i]], [embeddings[j]])[0][0]
                    similarity_matrix[i][j] = similarity_matrix[j][i] = similarity

        flattened_similarities = similarity_matrix[np.triu_indices_from(similarity_matrix, k=1)]  # Get upper triangle values (excluding diagonal b/c they're identical)
        mean = np.mean(flattened_similarities)
        std_dev = np.std(flattened_similarities)

        # Normalize similarity scores
        normalized_similarity = (flattened_similarities - mean) / std_dev

        plagiarism_matrix = np.zeros_like(similarity_matrix)
    
        # Threshold is based on the normalized similarity
        for i in range(len(similarity_matrix)):
            for j in range(i+1, len(similarity_matrix)):
                if similarity_matrix[i][j] > mean + threshold * std_dev:
                    plagiarism_matrix[i][j] = plagiarism_matrix[j][i] = 1  # Mark as plagiarized
        
        return plagiarism_matrix
