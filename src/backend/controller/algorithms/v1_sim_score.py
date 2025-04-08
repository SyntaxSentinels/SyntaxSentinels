import abstract_similarity_score
from v1_NLP import *
class basic_weighting(abstract_similarity_score):
    def score(data):

        file_pairs = feed_head_model().compute_similarities_from_zip(data)

        statuses = feed_head_model().combinedPredict(data)

        results = [
        {
            "file1": fname1,
            "file2": fname2,
            "raw_scores": [token_sim, ast_sim, embed_sim],
            "similarity_score": 0.5 * embed_sim + 0.1 * ast_sim + 0.4 * token_sim #decides how final score is calculated
        }
        for fname1, fname2, token_sim, ast_sim, embed_sim in file_pairs]

        return {
            "similarity_results": results,
            "plagiarism_results": statuses
        }