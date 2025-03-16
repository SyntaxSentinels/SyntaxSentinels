from flask import Flask, request, jsonify
from controller.compute import compute_similarities_from_zip
from controller.algorithms.privacy_preserving_comparison import DolosStyleComparison
import os
import re
import difflib
import torch
from transformers import RobertaTokenizer, RobertaModel

app = Flask(__name__)

# Initialize tokenizer and model for line-by-line comparison
tokenizer = RobertaTokenizer.from_pretrained("microsoft/codebert-base")
model = RobertaModel.from_pretrained("microsoft/codebert-base")
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

@app.route('/similarity', methods=['POST'])
def similarity():
    """
    Expects a POST request with a ZIP file containing Python files.
    The ZIP file can be sent either as a multipart/form-data file (with key "file")
    or as raw binary data.
    
    Optionally, a "model" query parameter can override the default model.
    Available models:
    - "graphbert" (default) - GraphBERT model that combines CodeBERT with AST information
    - "microsoft/codebert-base" - Original CodeBERT model
    """
    # Retrieve optional model override from query parameters
    model_name = request.args.get("model", "graphbert")

    # Check if the client sent the file as multipart/form-data
    if "file" in request.files:
        zip_bytes = request.files["file"].read()
    else:
        # Otherwise, assume the ZIP is sent as raw binary data
        zip_bytes = request.get_data()

    if not zip_bytes:
        return jsonify({"error": "No zip file data provided"}), 400

    try:
        # Process the ZIP bytes and compute similarity results
        results = compute_similarities_from_zip(zip_bytes, model_name)
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/compare-files', methods=['POST'])
def compare_files():
    """
    Expects a POST request with file1 and file2 paths.
    Returns a comprehensive similarity report with privacy-preserving line-by-line comparison.
    
    Optionally, a "modelName" parameter in the request body or a "model" query parameter 
    can override the default model.
    Available models:
    - "graphbert" (default) - GraphBERT model that combines CodeBERT with AST information
    - "microsoft/codebert-base" - Original CodeBERT model
    """
    data = request.json
    if not data or 'file1' not in data or 'file2' not in data:
        return jsonify({"error": "Missing file paths"}), 400

    file1_path = data['file1']
    file2_path = data['file2']
    model_name = data.get('modelName') or request.args.get("model", "graphbert")
    
    # Initialize the Dolos-style comparison system
    comparison_system = DolosStyleComparison(model_name)

    try:
        # Read the actual file contents
        if not os.path.exists(file1_path):
            return jsonify({"error": f"File not found: {file1_path}"}), 404
        if not os.path.exists(file2_path):
            return jsonify({"error": f"File not found: {file2_path}"}), 404
            
        # Read the files
        with open(file1_path, 'r', encoding='utf-8') as f1:
            file1_content = f1.read()
            
        with open(file2_path, 'r', encoding='utf-8') as f2:
            file2_content = f2.read()

        # Compute comprehensive similarity report
        similarity_report = comparison_system.compare_files(file1_content, file2_content)
        
        # For the frontend, we need to provide line numbers for display
        # but we don't want to send the actual code content for privacy reasons
        file1_lines = file1_content.splitlines()
        file2_lines = file2_content.splitlines()
        
        return jsonify({
            "file1LineCount": len(file1_lines),
            "file2LineCount": len(file2_lines),
            "overallSimilarity": similarity_report["overall_similarity"],
            "file1Coverage": similarity_report["file1_coverage"],
            "file2Coverage": similarity_report["file2_coverage"],
            "matchedLineCount": similarity_report["matched_line_count"],
            "heatmapData": similarity_report["heatmap_data"],
            "lineComparisons": similarity_report["line_comparisons"]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_line_embedding(line):
    """Generate an embedding for a code line using the model."""
    inputs = tokenizer(line, return_tensors="pt", max_length=512, truncation=True, padding="max_length")
    inputs = {key: val.to(device) for key, val in inputs.items()}
    
    with torch.no_grad():
        outputs = model(**inputs)
        embedding = outputs.last_hidden_state[:, 0, :]
    
    return embedding

def compute_line_similarity(line1, line2):
    """Compute similarity between two code lines."""
    # Skip empty lines
    if not line1.strip() or not line2.strip():
        return 0.0
    
    # Get embeddings
    embedding1 = get_line_embedding(line1)
    embedding2 = get_line_embedding(line2)
    
    # Compute cosine similarity
    cosine_sim = torch.nn.functional.cosine_similarity(embedding1, embedding2).item()
    return max(0.0, min(1.0, cosine_sim))

def compare_code_lines(file1_lines, file2_lines):
    """Compare lines between two files and return similarity scores."""
    # Use difflib to find matching lines
    matcher = difflib.SequenceMatcher(None, file1_lines, file2_lines)
    
    line_comparisons = []
    
    # Process each matching block
    for a, b, size in matcher.get_matching_blocks():
        if size > 0:
            for i in range(size):
                line1 = file1_lines[a + i]
                line2 = file2_lines[b + i]
                
                # Compute similarity score for this line pair
                similarity = compute_line_similarity(line1, line2)
                
                # Only include if similarity is above threshold
                if similarity > 0.7:  # Threshold for considering lines similar
                    line_comparisons.append({
                        "file1Line": line1,
                        "file2Line": line2,
                        "similarity": similarity
                    })
    
    return line_comparisons

if __name__ == '__main__':
    # Run the app in debug mode for easier local testing.
    app.run(debug=True)
