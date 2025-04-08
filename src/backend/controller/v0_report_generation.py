from algorithms.abstract_report_generation import abstract_report_generation
from algorithms.v0_cosine_similarity import cosine_similarity as plagiarism
import json

class report_generation(abstract_report_generation):
    def generate(data):
        data = json.loads(data)
        plagiarism_matrix = plagiarism.score(data)
        data.update({'plagiarism_matrix': plagiarism_matrix.tolist()})
        results = report_generation._assemble_visuals(data)
        return results
