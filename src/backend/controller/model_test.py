import torch
import torch.nn as nn
import torch.optim as optim
import os
import math

class PlagiarismDetectionModel(nn.Module):
    def __init__(self):
        super(PlagiarismDetectionModel, self).__init__()
        
        # Input layer for 5 features (3 LSE outputs + 2 additional features)
        self.fc1 = nn.Linear(5, 64)  # 5 input features
        self.fc2 = nn.Linear(64, 128)  # Hidden layer
        self.fc3 = nn.Linear(128, 64)  # Another hidden layer
        self.fc4 = nn.Linear(64, 2)  # Output layer for similarity score and plagiarism status

    def log_sum_exp(self, x):
        """
        Applies the Log-Sum-Exp function to each row in the input matrix `x`.
        """
        # Apply log-sum-exp (LSE) across each row (each snippet)

        return torch.tanh(1/(len(x)*torch.logsumexp(x, dim=1)) ) # Shape will be (batch_size)

    def forward(self, token_sim, ast_sim, embed_sim, batch_mean_sim, snippet_mean_sim):
        # Ensure all input tensors are 2D (batch_size, num_pairs)
        batch_size = token_sim.size(0)
        batch_mean_sim = batch_mean_sim.view(batch_size, 1)  # Shape: (batch_size, 1)
        snippet_mean_sim = snippet_mean_sim.view(batch_size, 1)  # Shape: (batch_size, 1)

        # Concatenate all inputs into a single tensor (batch_size, num_pairs * 5 features)
        # Flatten token_sim, ast_sim, embed_sim to have a shape of (batch_size, num_pairs)
        x = torch.cat((token_sim, ast_sim, embed_sim, batch_mean_sim, snippet_mean_sim), dim=1)  # Shape: (batch_size, 5)
        x = x.double()
        # Apply the log-sum-exp (LSE) function to the incoming vectors (token_sim, ast_sim, embed_sim)
        # We assume token_sim, ast_sim, embed_sim are 2D with shape (batch_size, num_pairs)
        # lse_token = self.log_sum_exp(token_sim)
        # lse_ast = self.log_sum_exp(ast_sim)
        # lse_embed = self.log_sum_exp(embed_sim)

        max_token = torch.max(token_sim, dim=-1).values
        max_ast = torch.max(ast_sim, dim=-1).values
        max_embed = torch.max(embed_sim, dim=-1).values

        # Now combine these LSE values along with batch_mean_sim and snippet_mean_sim
        # lse_token.unsqueeze(-1), lse_ast.unsqueeze(-1), lse_embed.unsqueeze(-1),
        x = torch.cat((
            max_token.unsqueeze(-1), max_ast.unsqueeze(-1), max_embed.unsqueeze(-1),
            batch_mean_sim, snippet_mean_sim
        ), dim=-1)  # Shape: (batch_size, 8) after concatenation
        print(x)
        # Pass through the first hidden layer (fc1) and apply ReLU activation
        x = torch.relu(self.fc1(x))  # Shape: (batch_size, 64)
        
        # Pass through the second hidden layer (fc2) and apply ReLU activation
        x = torch.relu(self.fc2(x))  # Shape: (batch_size, 128)
        
        # Pass through the third hidden layer (fc3) and apply ReLU activation
        x = torch.relu(self.fc3(x))  # Shape: (batch_size, 64)
        
        # Output layer (fc4) to get predicted similarity and plagiarism status
        outputs = self.fc4(x)  # Outputs: [max_similarity_score, plag_status]
        
        # Split the output into the two components
        predicted_similarity = outputs[:, 0]  # First column: max similarity score
        predicted_plagiarism = torch.sigmoid(outputs[:, 1])  # Second column: plagiarism status (sigmoid output)
        
        return predicted_similarity, predicted_plagiarism

def train(batch, ground_truth_data, rec_check=None, num_epochs=10, check_count =0):
    # Initialize the model and optimizer
    model = PlagiarismDetectionModel()
    model = model.to(torch.float64)
    optimizer = optim.Adam(model.parameters(), lr=0.01)

    # Loss function
    criterion_similarity = nn.MSELoss()  # Mean squared error for similarity score
    criterion_status = nn.BCEWithLogitsLoss()  # Binary cross-entropy for plagiarism status

    # Simulated batch data: similarity scores for pairwise comparisons
    # batch = {
    #     'token_sim': torch.tensor([[0.8, 0.6, 0.7], [0.7, 0.5, 0.9], [0.6, 0.8, 0.7]]),  # Token similarity scores
    #     'ast_sim': torch.tensor([[0.7, 0.9, 0.8], [0.6, 0.8, 0.7], [0.9, 0.5, 0.6]]),    # AST similarity scores
    #     'embed_sim': torch.tensor([[0.8, 0.7, 0.6], [0.7, 0.6, 0.8], [0.6, 0.9, 0.7]]),   # Embedding similarity scores
    #     'batch_mean_sim': torch.tensor([0.75, 0.75, 0.75]),  # Batch mean similarity
    #     'snippet_mean_sim': torch.tensor([0.8, 0.7, 0.85])  # Snippet mean similarity
    # }

    # Define the true labels for similarity and status (max similarity score and plag status per file)
    # ground_truth_data = [
    #     ['file1.py', 0.95, 1],
    #     ['file2.py', 0.95, 1],
    #     ['file3.py', 0.7, 0]
    # ]

    # Training loop (for illustration)
    # num_epochs = 10
    checkpoint_dir = 'checkpoints'
    os.makedirs(checkpoint_dir, exist_ok=True)  # Create directory for saving checkpoints

    if rec_check:
        checkpoint = torch.load(rec_check)
        
        # Load model and optimizer state dict
        model.load_state_dict(checkpoint['model_state_dict'])
        optimizer.load_state_dict(checkpoint['optimizer_state_dict'])

    for epoch in range(num_epochs):
        model.train()
        
        # Step 1: Forward pass through the model to get predicted similarity scores and plagiarism status
        predicted_similarity, predicted_plagiarism = model(
            batch['token_sim'], 
            batch['ast_sim'], 
            batch['embed_sim'], 
            batch['batch_mean_sim'], 
            batch['snippet_mean_sim']
        )
        
        # Step 2: Convert ground truth data to tensors for loss comparison
        ground_truth_similarity = torch.tensor([entry[1] for entry in ground_truth_data], dtype=torch.float64).view(-1, 1)
        ground_truth_status = torch.tensor([entry[2] for entry in ground_truth_data], dtype=torch.float64).view(-1, 1)
        
        # Step 3: Calculate the loss for similarity prediction (MSE)
        similarity_loss = criterion_similarity(predicted_similarity.view(-1, 1), ground_truth_similarity)
        
        # Step 4: Calculate the plagiarism status loss (BCE)
        status_loss = criterion_status(predicted_plagiarism.view(-1, 1), ground_truth_status)
        
        # Total loss is the sum of similarity and status losses
        total_loss = similarity_loss + status_loss

        total_loss = total_loss.double()
        
        # Step 5: Backpropagation and optimization
        optimizer.zero_grad()
        total_loss.backward()  # Backpropagate the loss
        optimizer.step()  # Update the model weights

        # Print the results for this epoch
        print(f"Epoch [{epoch+1}/{num_epochs}], Similarity Loss: {similarity_loss.item():.4f}, Status Loss: {status_loss.item():.4f}, Total Loss: {total_loss.item():.4f}")
        
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