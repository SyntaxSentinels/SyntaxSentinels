from compute import *
from model_v0 import *
import random
import torch 
import json
import pandas as pd
import os

output_preds = True
eval_on = True #only evaluates, no weighting change 
#set up the following parameters and training will be done automatically
rec_check = 'checkpoint_epoch_10.pth' #Set to path of checkpoint you wish to train form. None if you wish to start fresh
check_count = 0 #set to current checkpoint count you wish to train/eval from. None if you wish to start fresh
training_eval_set =['p00005','p00007','p02233','p02271','p02256', 'p02258', 'p02379','p02261','p02264','p02266','p02267','p02269'] #zip files for training 
training_eval_set = ['p02381','p02239', 'p02405', 'p02260', 'p02272'] #for eval
batch_pairs = [] # leave empty
for file_name in training_eval_set: #given file to work with
    # Specify the path to the ZIP file
    zip_file_path = os.path.join(os.path.dirname(__file__), f"data_folder\\{file_name}.zip")

    # Read the entire ZIP file as bytes
    with open(zip_file_path, 'rb') as file:
        zip_file_bytes = file.read()

    files = extract_python_files_from_zip(zip_file_bytes)

    results = compute_similarities_from_zip(zip_file_bytes)['similarity_results']

    data = {}
    batch_mean = 0
    size = 0

    for file in files:
        data[os.path.basename(file[0])] = {'token_sim':[],'ast_sim':[], 'embed_sim':[], 'snippet_mean_sim': 0}

    batch_mean = 0
    for pair in results:

        file1 = os.path.basename(pair['file1'])
        file2 = os.path.basename(pair['file2'])
        data[file1]['token_sim'].append(pair['raw_scores'][0])
        data[file1]['ast_sim'].append( pair['raw_scores'][1])
        data[file1]['embed_sim'].append( pair['raw_scores'][2])

        data[file2]['token_sim'].append(pair['raw_scores'][0])
        data[file2]['ast_sim'].append( pair['raw_scores'][1])
        data[file2]['embed_sim'].append( pair['raw_scores'][2])

        data[file1]['snippet_mean_sim']+= pair['raw_scores'][2]
        data[file2]['snippet_mean_sim']+= pair['raw_scores'][2]
        batch_mean += pair['raw_scores'][2]
        size +=1

    for file in files:
        name = os.path.basename(file[0])
        data[name]['snippet_mean_sim'] =  data[name]['snippet_mean_sim']/(len(files)-1)
        data[name]['batch_mean_sim'] =  batch_mean/size

    sorted_data = dict(sorted(data.items()))

    batch = {
    'token_sim': torch.tensor([v['token_sim'] for _,v in sorted_data.items()]),  # Token similarity scores
    'ast_sim': torch.tensor([v['ast_sim'] for _,v in sorted_data.items()]),    # AST similarity scores
    'embed_sim': torch.tensor([v['embed_sim'] for _,v in sorted_data.items()]),   # Embedding similarity scores
    'batch_mean_sim': torch.tensor([v['batch_mean_sim'] for _,v in sorted_data.items()]),  # Batch mean similarity
    'snippet_mean_sim': torch.tensor([v['snippet_mean_sim'] for _,v in sorted_data.items()])  # Snippet mean similarity

    }

    #path to corresponding ground truth for batch
    ground_truths = os.path.join(os.path.dirname(__file__), f'metrics\\{file_name}_modified_analysis_results.csv')

    df = pd.read_csv(ground_truths)

    df_sorted = df.sort_values(by=['0'])

    ground_truth_data = df_sorted[['0','Adjusted_Max_Similarity_Score','Status']].values.tolist()

    batch_pairs.append((batch, ground_truth_data))

if not(eval_on):
    rec_check, check_count = \
        train(batch_pairs = batch_pairs,
        num_epochs=10,
        rec_check=rec_check,
        check_count=check_count)
else:
    predictions, v = eval(batch_pairs = batch_pairs,
            rec_check=rec_check
    )

    if output_preds:
        
        for i, predicted_plagiarism in enumerate(predictions):
            predictions_iterated = []
            for i in range(len(predicted_plagiarism)):
                predictions_iterated.append([f"file_{i+1}.py", predicted_plagiarism[i].item()])

            df = pd.DataFrame(predictions_iterated, columns=['filename', 'predicted_plagiarism'])

            # Step 6: Save the DataFrame to CSV
            df.to_csv(os.path.join(os.path.dirname(__file__), f'predictions\\{v}_batch_{i}_predictions.csv'), index=False)


