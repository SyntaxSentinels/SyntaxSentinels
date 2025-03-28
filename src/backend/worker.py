import os
import json
import time
import tempfile
import zipfile
import logging
import requests
import boto3
import gzip
import base64
from dotenv import load_dotenv
from controller.compute import compute_similarities_from_zip

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('worker')

# AWS Configuration
AWS_REGION = os.getenv('AWS_REGION')
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME')
SQS_QUEUE_URL = os.getenv('SQS_QUEUE_URL')
EXPRESS_API_URL = os.getenv('EXPRESS_API_URL')

# Initialize AWS clients
s3 = boto3.client('s3', region_name=AWS_REGION)
sqs = boto3.client('sqs', region_name=AWS_REGION)

def download_from_s3(s3_key):
    """
    Download a file from S3 to a temporary file
    """
    logger.info(f"Downloading file from S3: {s3_key}")
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        try:
            s3.download_fileobj(
                Bucket=S3_BUCKET_NAME,
                Key=s3_key,
                Fileobj=tmp
            )
            return tmp.name
        except Exception as e:
            logger.error(f"Error downloading file from S3: {e}")
            raise

def update_job_status(job_id, status, result_data=None):
    """
    Update job status and results via Express API
    """
    logger.info(f"Updating job status: {job_id} to {status}")
    url = f"{EXPRESS_API_URL}/results/update"
    payload = {
        'jobId': job_id,
        'status': status
    }
    
    def compress_data(data):
        json_data = json.dumps(data)  # Convert to JSON string
        compressed = gzip.compress(json_data.encode("utf-8"))  # Encode and compress
        return base64.b64encode(compressed).decode("utf-8")  # Encode to base64 for safe transmission

    if result_data:
        payload['resultData'] = compress_data(result_data)
        
    try:
        response = requests.post(url, json=payload)
        if response.status_code != 200:
            logger.error(f"Error updating job status: {response.text}")
            return False
        return True
    except Exception as e:
        logger.error(f"Error updating job status: {e}")
        return False

def process_message(message):
    """
    Process a message from the SQS queue
    """
    job_id = None  # Initialize job_id to None
    try:
        # Parse message body
        body = json.loads(message['Body'])
        job_id = body.get('jobId')
        s3_key = body.get('s3Key')
        auth0_id = body.get('auth0Id')
        analysis_name = body.get('analysisName')
        
        logger.info(f"Processing job: {job_id} for user: {auth0_id}")
        
        # Update job status to processing
        update_job_status(job_id, 'processing')
        
        # Download file from S3
        temp_file_path = download_from_s3(s3_key)
        
        try:
            # Read the zip file
            with open(temp_file_path, 'rb') as f:
                zip_bytes = f.read()
            
            # Process the zip file
            logger.info(f"Processing file: {temp_file_path}")
            result_data = compute_similarities_from_zip(zip_bytes)
            
            # Update job status to completed with results
            update_job_status(job_id, 'completed', result_data)
            logger.info(f"Job completed: {job_id}")
            
        except Exception as e:
            logger.error(f"Error processing file: {e}")
            update_job_status(job_id, 'failed')
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
            # Delete the S3 object
            s3.delete_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
            logger.info(f"Deleted S3 object: {s3_key}")
                
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        # If we have a job ID, update its status to failed
        if job_id:  # Check if job_id has been assigned a value
            update_job_status(job_id, 'failed')

    finally:
        # Delete the message from the queue
        try:
            sqs.delete_message(
                QueueUrl=SQS_QUEUE_URL,
                ReceiptHandle=message['ReceiptHandle']
            )
            logger.info(f"Deleted message with ReceiptHandle: {message['ReceiptHandle']}")
        except Exception as e:
            logger.error(f"Error deleting message: {e}")
            # Handle the failure to delete (e.g., log, potentially retry later)

def poll_sqs_queue():
    """
    Poll the SQS queue for messages
    """
    logger.info(f"Starting to poll SQS queue: {SQS_QUEUE_URL}")
    
    while True:
        try:
            # Receive message from SQS queue
            response = sqs.receive_message(
                QueueUrl=SQS_QUEUE_URL,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=20,  # Long polling
                AttributeNames=['All'],
                MessageAttributeNames=['All']
            )
            
            # Process messages if any
            if 'Messages' in response:
                for message in response['Messages']:
                    logger.info(f"Received message: {message['MessageId']}")
                    
                    # Process the message
                    process_message(message)
                    
            else:
                logger.debug("No messages received")
                
        except Exception as e:
            logger.error(f"Error polling SQS queue: {e}")
            
        # Small delay to prevent tight loop
        time.sleep(1)

if __name__ == "__main__":
    poll_sqs_queue()

