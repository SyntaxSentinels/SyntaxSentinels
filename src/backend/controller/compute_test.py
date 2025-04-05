from compute import *
from model_test import *
import torch 
import json
import pandas as pd

rec_check = None 
check_count = 0
validation = ['p02381','p02239', 'p02405', 'p02260', 'p02272']
# ['p00005','p00007','p02233','p02271','p02256', 'p02258', 'p02379','p02261','p02264','p02266','p02267','p02269']:

for file_name in ['p02381']: #given file to work with
    # Specify the path to the ZIP file
    zip_file_path = f'data_folder\\{file_name}.zip'

    # Read the entire ZIP file as bytes
    with open(zip_file_path, 'rb') as file:
        zip_file_bytes = file.read()

    from compute import *

    files = extract_python_files_from_zip(zip_file_bytes)
    print(len(files))

#     batch = {
#     'token_sim': torch.tensor([[0.8, 0.6, 0.7], [0.7, 0.5, 0.9], [0.6, 0.8, 0.7]]),  # Token similarity scores
#     'ast_sim': torch.tensor([[0.7, 0.9, 0.8], [0.6, 0.8, 0.7], [0.9, 0.5, 0.6]]),    # AST similarity scores
#     'embed_sim': torch.tensor([[0.8, 0.7, 0.6], [0.7, 0.6, 0.8], [0.6, 0.9, 0.7]]),   # Embedding similarity scores
#     'batch_mean_sim': torch.tensor([0.75, 0.75, 0.75]),  # Batch mean similarity
#     'snippet_mean_sim': torch.tensor([0.8, 0.7, 0.85])  # Snippet mean similarity
# }

    results = compute_similarities_from_zip(zip_file_bytes)

    with open(f'{file_name}.txt', "w") as file:
        file.write(json.dumps(results)+"\n")


    data = {}
    batch_mean = 0
    size = 0

    for file in files:
        data[file[0].split('/')[1]] = {'token_sim':[],'ast_sim':[], 'embed_sim':[], 'snippet_mean_sim': 0}

    batch_mean = 0
    for pair in results:
        file1 = pair['file1'].split('/')[1]
        file2 = pair['file2'].split('/')[1]
        data[file1]['token_sim'].append(pair['similarity_score'][0])
        data[file1]['ast_sim'].append( pair['similarity_score'][1])
        data[file1]['embed_sim'].append( pair['similarity_score'][2])

        data[file2]['token_sim'].append(pair['similarity_score'][0])
        data[file2]['ast_sim'].append( pair['similarity_score'][1])
        data[file2]['embed_sim'].append( pair['similarity_score'][2])

        data[file1]['snippet_mean_sim']+= pair['similarity_score'][2]
        data[file2]['snippet_mean_sim']+= pair['similarity_score'][2]
        batch_mean += 2*pair['similarity_score'][2]
        size +=2

    for file in files:
        name = file[0].split('/')[1]
        data[name]['snippet_mean_sim'] =  data[name]['snippet_mean_sim']/(len(files)-1)
        data[name]['batch_mean_sim'] =  batch_mean/size

    sorted_data = dict(sorted(data.items()))

    batch = {
    'token_sim': torch.tensor([v['token_sim'] for _,v in data.items()]),  # Token similarity scores
    'ast_sim': torch.tensor([v['ast_sim'] for _,v in data.items()]),    # AST similarity scores
    'embed_sim': torch.tensor([v['embed_sim'] for _,v in data.items()]),   # Embedding similarity scores
    'batch_mean_sim': torch.tensor([v['batch_mean_sim'] for _,v in data.items()]),  # Batch mean similarity
    'snippet_mean_sim': torch.tensor([v['snippet_mean_sim'] for _,v in data.items()])  # Snippet mean similarity

    }


    with open(f'{file_name}_batch.txt', "w") as file:
        file.write(json.dumps(data))



    excel_file_path = "training only"

    # df = pd.read_csv(excel_file_path)

    # df_sorted = df.sort_values(by=['0'])

    # df_sorted.to_csv('groundtruths_output', index=False)
    # ground_truth_data = df_sorted[['0','Adjusted_Max_Similarity_Score','Status']].values.tolist()
    
    # rec_check, check_count = \
    #     train(batch = batch, 
    #       ground_truth_data = ground_truth_data,
    #       rec_check=rec_check,
    #       check_count=check_count)

    model = PlagiarismDetectionModel()
    model = model.to(torch.float64)

    cpk_path = "src\\backend\\controller\\checkpoints\\checkpoint_epoch_120.pth"
    checkpoint = torch.load(cpk_path)  # Provide the path to your saved checkpoint file

    # If the checkpoint contains only the model's state_dict, load it
    model.load_state_dict(checkpoint['model_state_dict'])

    model.eval()
    with torch.no_grad():  # Disable gradient computation during inference
        predicted_similarity, predicted_plagiarism = model(
                batch['token_sim'], 
                batch['ast_sim'], 
                batch['embed_sim'], 
                batch['batch_mean_sim'], 
                batch['snippet_mean_sim']
            )
    
    predictions = []
    for i in range(len(predicted_similarity)):
        predictions.append([f"file_{i+1}.py", predicted_similarity[i].item(), predicted_plagiarism[i].item()])

    max_token_sim = batch['token_sim'].max(dim=1).values
    max_ast_sim = batch['ast_sim'].max(dim=1).values
    max_embed_sim = batch['embed_sim'].max(dim=1).values

    # Collecting the values along with batch mean and snippet mean similarities
    output_data = {
        'max_token_sim': max_token_sim.numpy(),
        'max_ast_sim': max_ast_sim.numpy(),
        'max_embed_sim': max_embed_sim.numpy(),
        'batch_mean_sim': batch['batch_mean_sim'].numpy(),
        'snippet_mean_sim': batch['snippet_mean_sim'].numpy()
    }

    # Create a DataFrame from the output data
    df = pd.DataFrame(output_data)

    # Save DataFrame to CSV
    df.to_csv('output_batch_data.csv', index=False) #predictions made to files in alphabetical order

    # # Step 5: Create a DataFrame and save to CSV
    # df = pd.DataFrame(predictions, columns=['filename', 'predicted_similarity', 'predicted_plagiarism'])

    # # Step 6: Save the DataFrame to CSV
    # df.to_csv('predictions_output.csv', index=False)

