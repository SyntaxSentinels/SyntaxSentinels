
import controller.algorithms.abstract_NLP
from controller.algorithms.v1_ast import * 
from controller.algorithms.v1_tok import * 
from controller.algorithms.v1_model import *
import hashlib
import torch 

from transformers import RobertaTokenizer, RobertaModel, AutoTokenizer, AutoModel

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

class feed_head_model(abstract_NLP):

    def combinedPredict(self, data, results) -> list[dict[str, float]]:
        python_files = data

        # Prepare data for model prediction
        data = {}
        batch_mean = 0
        size = 0

        for file in python_files:
            data[file[0]] = {'token_sim':[], 'ast_sim':[], 'embed_sim':[], 'snippet_mean_sim': 0}

        # Calculate similarities and means
        for pair in results:
            file1 = pair['file1']
            file2 = pair['file2']
            
            data[file1]['token_sim'].append(pair['token_sim'])
            data[file1]['ast_sim'].append(pair['ast_sim'])
            data[file1]['embed_sim'].append(pair['embed_sim'])
            
            data[file2]['token_sim'].append(pair['token_sim'])
            data[file2]['ast_sim'].append(pair['ast_sim'])
            data[file2]['embed_sim'].append(pair['embed_sim'])
            
            data[file1]['snippet_mean_sim'] += pair['embed_sim']
            data[file2]['snippet_mean_sim'] += pair['embed_sim']
            batch_mean += 2 * pair['embed_sim']
            size += 2

        # Calculate final means
        for file in python_files:
            name = file[0]
            data[name]['snippet_mean_sim'] = data[name]['snippet_mean_sim'] / (len(python_files) - 1)
            data[name]['batch_mean_sim'] = batch_mean / size

        # Prepare batch for model
        batch = {
            'token_sim': torch.tensor([v['token_sim'] for _, v in data.items()]),
            'ast_sim': torch.tensor([v['ast_sim'] for _, v in data.items()]),
            'embed_sim': torch.tensor([v['embed_sim'] for _, v in data.items()]),
            'batch_mean_sim': torch.tensor([v['batch_mean_sim'] for _, v in data.items()]),
            'snippet_mean_sim': torch.tensor([v['snippet_mean_sim'] for _, v in data.items()])
        }

        # Load and run model
        model = PlagiarismDetectionModel()
        
        # Load checkpoint
        cpk_path = os.path.join(os.path.dirname(__file__), "../checkpoints/checkpoint_epoch_10.pth")
        checkpoint = torch.load(cpk_path)
        model.load_state_dict(checkpoint['model_state_dict'])
        
        # Get predictions
        model.eval()
        with torch.no_grad():
            predicted_plagiarism = model(
                batch['token_sim'],
                batch['ast_sim'],
                batch['embed_sim'],
                batch['batch_mean_sim'],
                batch['snippet_mean_sim']
            )

        # Update results with model predictions
        final_results = []
        for i, file in enumerate(python_files):
            file_name = file[0]
            final_results.append({
                "file": file_name,
                "plagiarism_score": predicted_plagiarism[i].item()
        })

        return final_results
    
    def compute_similarities_from_zip(self, data):
        """
        Given a zip file (as bytes), extract Python files and compute pairwise similarity scores.
        Returns a list of dictionaries containing similarity results for each file pair.
        """
        python_files = data

        # Generate embeddings for all files upfront
        batch = [file[1] for file in python_files]
        map_file_name_to_idx = {os.path.basename(file[0]): i for i, file in enumerate(python_files)}
        batch_mapping = {os.path.basename(file_name): file_content for file_name, file_content in python_files}
        nlp_sim = EmbeddingSimilarity()
        nlp_embeddings = nlp_sim.get_embeddings_batch(batch)
        
        token_similarities_list = MOSS_tok().tokenize(batch_mapping)
        token_similarities_map = [[0 for _ in range(len(python_files))] for _ in range(len(python_files))]
        for similarity in token_similarities_list:
            file1, file2 = similarity['file1'], similarity['file2']
            idx1, idx2 = map_file_name_to_idx[file1], map_file_name_to_idx[file2]
            token_similarities_map[idx1][idx2] = similarity['similarity_score']
            token_similarities_map[idx2][idx1] = similarity['similarity_score']
        print('Finished tokenization')
        ast_similarities_list = vector_ast().score(batch_mapping)
        ast_similarities_map = [[0 for _ in range(len(python_files))] for _ in range(len(python_files))]
        for (file1, file2, similarity_score) in ast_similarities_list:
            idx1, idx2 = map_file_name_to_idx[file1], map_file_name_to_idx[file2]
            ast_similarities_map[idx1][idx2] = similarity_score
            ast_similarities_map[idx2][idx1] = similarity_score
        print('Finished ast calculation')
        # Create all unique pairs (i < j)
        n = len(python_files)
        file_pairs = []
        for i in range(n):
            for j in range(i + 1, n):
                file_pairs.append((
                    python_files[i][0], 
                    python_files[j][0], 
                    token_similarities_map[i][j],
                    ast_similarities_map[i][j],
                    nlp_sim.compute(nlp_embeddings[i], nlp_embeddings[j])
                ))

        return file_pairs


class EmbeddingSimilarity:
    def __init__(self, model_name="microsoft/codebert-base", batch_size=8):
        if "roberta" in model_name.lower():
            self.tokenizer = RobertaTokenizer.from_pretrained(model_name)
            self.model = RobertaModel.from_pretrained(model_name)
        else:
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModel.from_pretrained(model_name).to(device)
        self.embedding_cache = {}
        self.batch_size = batch_size

    def hash_code(self, code):
        """Generate a hash for the code snippet."""
        return hashlib.sha256(code.encode('utf-8')).hexdigest()

    def get_embeddings_batch(self, code_snippets):
        """Generate embeddings for a batch of code snippets."""
        inputs = self.tokenizer(
            code_snippets,
            return_tensors="pt",
            max_length=512,
            truncation=True,
            padding="max_length"
        )
        inputs = {key: val.to(device) for key, val in inputs.items()}

        with torch.no_grad():
            outputs = self.model(**inputs)
            batch_embeddings = outputs.last_hidden_state[:, 0, :]
        return batch_embeddings

    def compute(self, embedding1, embedding2):
        """Compute cosine similarity between embeddings of two code snippets."""
        cosine_sim = torch.nn.functional.cosine_similarity(
            embedding1.unsqueeze(0), embedding2.unsqueeze(0)
        ).item()
        # Normalize cosine similarity
        normalized_embed_sim = max(0.0, min(1.0, (cosine_sim - 0.99) * 100))
        return 1 / (1 + math.exp(-9 * (normalized_embed_sim - 0.5)))
    