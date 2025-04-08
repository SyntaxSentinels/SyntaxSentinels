import abstract_model
import torch.nn as nn
import torch.optim as optim
import os
import random
import math
import torch

class PlagiarismDetectionModel(nn.Module):
    def __init__(self):
        super(PlagiarismDetectionModel, self).__init__()
        self.v = "v0"
        # Input layer for 5 features (3 LSE outputs + 2 additional features)
        self.fc1 = nn.Linear(5, 64)  # 5 input features
        self.fc2 = nn.Linear(64, 128)  # Hidden layer
        self.fc3 = nn.Linear(128, 64)  # Another hidden layer
        self.fc4 = nn.Linear(64, 1)  # Output layer for similarity score and plagiarism status

        # Dropout layer for regularization
        self.dropout = nn.Dropout(p=0.3)  # Dropout with a rate of 30%


    def forward(self, token_sim, ast_sim, embed_sim, batch_mean_sim, snippet_mean_sim):
        # Ensure all input tensors are 2D (batch_size, num_pairs)
        batch_size = token_sim.size(0)
        batch_mean_sim = batch_mean_sim.view(batch_size, 1) 
        snippet_mean_sim = snippet_mean_sim.view(batch_size, 1)  

        max_token = normalize(torch.max(token_sim, dim=-1).values)
        max_ast = normalize(torch.max(ast_sim, dim=-1).values)
        max_embed = normalize(torch.max(embed_sim, dim=-1).values)

        x = torch.cat((
            max_token.unsqueeze(-1), max_ast.unsqueeze(-1), max_embed.unsqueeze(-1),
            batch_mean_sim, snippet_mean_sim
        ), dim=-1) 
        print(x)
        
        x = torch.relu(self.fc1(x)) 
        x = self.dropout(x)
        x = torch.relu(self.fc2(x))  
        x = self.dropout(x)
        x = torch.relu(self.fc3(x))    
        outputs = self.fc4(x)  
        
        predicted_plagiarism = torch.sigmoid(outputs)  # Second column: plagiarism status (sigmoid output for current rendition)
        # predicted_plagiarism = torch.round(predicted_plagiarism*10)/10  # Apply soft thresholding
        
        return predicted_plagiarism

def add_noise_to_weights(model, noise_std=0.01):

    for param in model.parameters():
        if param.requires_grad:
            noise = torch.normal(mean=0.0, std=noise_std, size=param.size())
            param.data += noise

def normalize(x):

    mean = torch.mean(x, dim=0, keepdim=True)  # Compute mean for each feature
    std = torch.std(x, dim=0, keepdim=True)    # Compute standard deviation for each feature
    return (x - mean) / (std + 1e-8)  # Normalize and avoid division by zero


class head_model(abstract_model):

    def predict(self,batch_pairs, rec_check=None):
        model = PlagiarismDetectionModel()
        model = model.to(torch.float64)
        model.eval()
        criterion_status = nn.BCEWithLogitsLoss() 
        checkpoint_dir = os.path.join(os.path.dirname(__file__), f"checkpoints")
        if rec_check:
            checkpoint = torch.load(os.path.join(checkpoint_dir, rec_check))
            
            # Load model and optimizer state dict
            model.load_state_dict(checkpoint['model_state_dict'])
        predictions = []
        
        i = 0
        for batch, ground_truth_data in batch_pairs:
            i+=1
            predicted_plagiarism = model(
                    batch['token_sim'], 
                    batch['ast_sim'], 
                    batch['embed_sim'], 
                    batch['batch_mean_sim'], 
                    batch['snippet_mean_sim']
                )
            ground_truth_status = torch.tensor([entry[2] for entry in ground_truth_data], dtype=torch.float64).view(-1, 1)
            status_loss = criterion_status(predicted_plagiarism.view(-1, 1), ground_truth_status)
            predictions.append(predicted_plagiarism)
            print(f"Batch {i}: Status Loss: {status_loss.item():.4f}, Total Loss: {status_loss.item():.4f}")

        return predictions, model.v


    def train(self, batch_pairs, rec_check=None, num_epochs=10, check_count =0):

        model = PlagiarismDetectionModel()
        model = model.to(torch.float64)
        optimizer = optim.Adam(model.parameters(), lr=0.01, weight_decay =1e-5)
        model.train()
        class_weights = torch.tensor([1.0, 10.0], dtype=torch.float64)
        criterion_status = nn.BCEWithLogitsLoss(pos_weight=class_weights[1])  # Binary cross-entropy for plagiarism status

        # Training loop
        checkpoint_dir = os.path.join(os.path.dirname(__file__), f"checkpoints")
        os.makedirs(checkpoint_dir, exist_ok=True)  # Create directory for saving checkpoints

        if rec_check:
            checkpoint = torch.load(rec_check)
            
            # Load model and optimizer state dict
            model.load_state_dict(checkpoint['model_state_dict'])
            optimizer.load_state_dict(checkpoint['optimizer_state_dict'])

        for epoch in range(num_epochs):
            total_loss = 0
            
            current_pairs = random.sample(batch_pairs, len(batch_pairs)-1)
            for batch, ground_truth_data in current_pairs:
                
                # Step 1: Forward pass through the model to get predicted similarity scores and plagiarism status
                predicted_plagiarism = model(
                    batch['token_sim'], 
                    batch['ast_sim'], 
                    batch['embed_sim'], 
                    batch['batch_mean_sim'], 
                    batch['snippet_mean_sim']
                )
                
                # Step 2: Convert ground truth data to tensors for loss comparison
                ground_truth_status = torch.tensor([entry[2] for entry in ground_truth_data], dtype=torch.float64).view(-1, 1)

                
                # Step 3: Calculate the plagiarism status loss (BCE)
                status_loss = criterion_status(predicted_plagiarism.view(-1, 1), ground_truth_status)
                
                # Total loss
                total_loss += status_loss.item()

                # Step 5: Backpropagation and optimization
                status_loss.backward()  # Backpropagate the loss

            optimizer.step()  # Update the model weights
            optimizer.zero_grad()

            if (epoch + 1) % 4 == 0:
                add_noise_to_weights(model, noise_std=0.01)

            print(f"Epoch [{epoch+1}/{num_epochs}], Total Loss: {total_loss:.4f}")
                
            # Save checkpoint every epoch
            checkpoint_path = os.path.join(checkpoint_dir, f"checkpoint_epoch_{check_count+1}.pth")

            checkpoint = {
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'epoch': epoch,
                'loss': total_loss
            }


            torch.save(checkpoint, checkpoint_path)
            print(f"Checkpoint saved at {checkpoint_path}")
            check_count +=1

        return checkpoint_path, check_count