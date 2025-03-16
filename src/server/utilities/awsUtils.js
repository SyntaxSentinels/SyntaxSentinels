import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import logger from './loggerUtils.js';
import { v4 as uuidv4 } from 'uuid';

// Configure AWS SDK
const config = {
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
};

// Initialize S3 and SQS clients
const s3Client = new S3Client(config);
const sqsClient = new SQSClient(config);

/**
 * Upload a file to S3
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} key - The S3 key (path) to store the file
 * @returns {Promise<Object>} - The S3 upload result
 */
export const uploadToS3 = async (fileBuffer, key) => {
  try {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: fileBuffer
    };
    
    const command = new PutObjectCommand(params);
    const result = await s3Client.send(command);
    logger.info(`File uploaded to S3: ${key}`);
    return result;
  } catch (error) {
    logger.error(`Error uploading file to S3: ${error.message}`);
    throw error;
  }
};

/**
 * Send a message to SQS FIFO queue
 * @param {string} jobId - The unique job ID
 * @param {string} s3Key - The S3 key where the file is stored
 * @param {string} auth0Id - The user's Auth0 ID
 * @param {string} analysisName - The name of the analysis
 * @param {string} modelName - The model used for analysis
 * @returns {Promise<Object>} - The SQS send message result
 */
export const sendToSQS = async (jobId, s3Key, auth0Id, analysisName, modelName = "graphbert") => {
  try {
    const params = {
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify({
        jobId,
        s3Key,
        auth0Id,
        analysisName,
        modelName,
        timestamp: new Date().toISOString()
      }),
      MessageGroupId: auth0Id, // Use auth0Id as group ID to ensure user's jobs are processed in order
      MessageDeduplicationId: jobId // Use jobId as deduplication ID
    };
    
    const command = new SendMessageCommand(params);
    const result = await sqsClient.send(command);
    logger.info(`Message sent to SQS: ${jobId}`);
    return result;
  } catch (error) {
    logger.error(`Error sending message to SQS: ${error.message}`);
    throw error;
  }
};

export default {
  uploadToS3,
  sendToSQS
};
