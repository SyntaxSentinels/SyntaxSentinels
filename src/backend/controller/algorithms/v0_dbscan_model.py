from controller.algorithms.abstract_model import abstract_model
import numpy as np
from sklearn.cluster import DBSCAN

class dbscan_model(abstract_model):
    weightings: list[float]
    model: DBSCAN

    def __init__(self):
        self.weightings = [0.5, 2]
        self.model = DBSCAN(eps = 0.5,
                       min_samples= 2,
                       metric = 'cosine')
        super().__init__()

    def train(self, data, supervised, timeout):
        return
    
    def predict(self, data):
        return self.model.fit_predict(data)



        