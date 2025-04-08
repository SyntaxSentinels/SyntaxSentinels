import os
import boto3
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# AWS Configuration
AWS_REGION = os.getenv('AWS_REGION')
SQS_QUEUE_URL = os.getenv('SQS_QUEUE_URL')

def purge_queue():
    """
    Purge all messages from the SQS queue
    """
    # Initialize SQS client
    sqs = boto3.client('sqs', region_name=AWS_REGION)
    
    try:
        # Purge the queue
        response = sqs.purge_queue(QueueUrl=SQS_QUEUE_URL)
        print(f"Queue purge initiated. Response: {response}")
    except Exception as e:
        print(f"Error purging queue: {e}")

if __name__ == "__main__":
    purge_queue() 