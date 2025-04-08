from controller.algorithms.abstract_model import abstract_model
from transformers import RobertaModel


class codebert_model(abstract_model):
    weightings: list[float]
    model: RobertaModel

    def __init__(self):
        self.weightings = [0]
        self.model = RobertaModel.from_pretrained("microsoft/codebert-base")
        super().__init__()

    def train(self, data, supervised, timeout):
        return 
    
    def predict(self, data):
        setup = self.model(**data)
        embeddings = setup.last_hidden_state.mean(dim=1)
        format_embeddings = embeddings.squeeze().detach().numpy()
        return {'embedding':format_embeddings }
        


        
    
