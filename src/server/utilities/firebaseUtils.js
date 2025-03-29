import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "./loggerUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.join(__dirname, "..", "firebase_cred.json");

// Initialize Firebase Admin SDK
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
  });

  logger.info("Firebase Admin SDK initialized successfully");
} catch (error) {
  logger.error("Error initializing Firebase Admin SDK:", error);
  throw new Error("Failed to initialize Firebase Admin SDK");
}

// Get Firestore database instance
const db = admin.firestore();

/**
 * Store analysis results in Firestore
 * @param {string} auth0Id - The user's Auth0 ID
 * @param {string} jobId - The unique job ID
 * @param {Object} resultData - The analysis results data
 * @param {string} analysisName - The name of the analysis
 * @returns {Promise<string>} - The document ID
 */
export const storeResults = async (
  auth0Id,
  jobId,
  resultData,
  analysisName = "Unnamed Analysis"
) => {
  try {
    // Create a reference to the results collection
    const resultsRef = db.collection("results");

    // Create a document with the job ID
    const docRef = resultsRef.doc(jobId);

    // Store the data
    await docRef.set({
      auth0Id,
      jobId,
      resultData,
      analysisName,
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Add to job_history collection
    const jobHistoryRef = db.collection("job_history").doc(auth0Id);

    // Use a transaction to update the job history
    await db.runTransaction(async (transaction) => {
      const jobHistoryDoc = await transaction.get(jobHistoryRef);

      if (!jobHistoryDoc.exists) {
        // Create a new document if it doesn't exist
        transaction.set(jobHistoryRef, {
          jobs: [
            {
              jobId,
              timestamp: new Date().toISOString(), // Use ISO string instead of server timestamp
              analysisName,
            },
          ],
        });
      } else {
        // Update existing document
        const jobHistory = jobHistoryDoc.data();
        const jobs = jobHistory.jobs || [];

        jobs.push({
          jobId,
          timestamp: new Date().toISOString(), // Use ISO string instead of server timestamp
          analysisName,
        });

        transaction.update(jobHistoryRef, { jobs });
      }
    });

    logger.info(
      `Results stored in Firestore with job ID: ${jobId} and analysis name: ${analysisName}`
    );
    logger.info(`Job added to job_history for user: ${auth0Id}`);
    return jobId;
  } catch (error) {
    logger.error("Error storing results in Firestore:", error);
    throw error;
  }
};

/**
 * Get analysis results from Firestore
 * @param {string} jobId - The unique job ID
 * @returns {Promise<Object|null>} - The analysis results or null if not found
 */
export const getResults = async (jobId) => {
  try {
    // Get the document reference
    const docRef = db.collection("results").doc(jobId);

    // Get the document
    const doc = await docRef.get();

    if (!doc.exists) {
      logger.warn(`No results found for job ID: ${jobId}`);
      return null;
    }

    logger.info(`Retrieved results for job ID: ${jobId}`);
    return doc.data();
  } catch (error) {
    logger.error("Error retrieving results from Firestore:", error);
    throw error;
  }
};

/**
 * Update job status in Firestore
 * @param {string} jobId - The unique job ID
 * @param {string} status - The job status ('pending', 'processing', 'completed', 'failed')
 * @returns {Promise<void>}
 */
export const updateJobStatus = async (jobId, status) => {
  try {
    // Get the document reference
    const docRef = db.collection("results").doc(jobId);

    // Update the status
    await docRef.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Updated status for job ID: ${jobId} to ${status}`);
  } catch (error) {
    logger.error(`Error updating status for job ID: ${jobId}:`, error);
    throw error;
  }
};

/**
 * Add analysis results to an existing job in Firestore
 * @param {string} jobId - The unique job ID
 * @param {Object} resultData - The analysis results data
 * @returns {Promise<void>}
 */
export const addResults = async (jobId, resultData) => {
  try {
    // Get the document reference
    const docRef = db.collection("results").doc(jobId);

    // Update the document with the result data
    await docRef.update({
      resultData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Updated results for job ID: ${jobId}`);
  } catch (error) {
    logger.error(`Error updating results for job ID: ${jobId}:`, error);
    throw error;
  }
};

/**
 * Get all jobs for a specific user
 * @param {string} auth0Id - The user's Auth0 ID
 * @returns {Promise<Array>} - Array of job objects
 */
export const getUserJobs = async (auth0Id) => {
  try {
    // First check the job_history collection
    const jobHistoryRef = db.collection("job_history").doc(auth0Id);
    const jobHistoryDoc = await jobHistoryRef.get();

    if (jobHistoryDoc.exists) {
      const jobHistory = jobHistoryDoc.data();
      const jobIds = jobHistory.jobs
        ? jobHistory.jobs.map((job) => job.jobId)
        : [];

      if (jobIds.length === 0) {
        logger.info(`No jobs found in job_history for user: ${auth0Id}`);
        return [];
      }

      // Get all jobs from the results collection
      const jobs = [];

      // Firestore can only query 10 items at a time with 'in' operator
      // So we need to batch the requests if there are more than 10 job IDs
      const batchSize = 10;
      for (let i = 0; i < jobIds.length; i += batchSize) {
        const batch = jobIds.slice(i, i + batchSize);
        const batchSnapshot = await db
          .collection("results")
          .where(admin.firestore.FieldPath.documentId(), "in", batch)
          .get();

        batchSnapshot.forEach((doc) => {
          const data = doc.data();
          jobs.push({
            jobId: doc.id,
            status: data.status,
            analysisName: data.analysisName || "Unnamed Analysis",
            createdAt: data.createdAt ? data.createdAt.toDate() : null,
            updatedAt: data.updatedAt ? data.updatedAt.toDate() : null,
            // Don't include the full result data to keep the response size small
            hasResults: !!data.resultData,
          });
        });
      }

      // Sort by createdAt in descending order
      jobs.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt - a.createdAt;
      });

      logger.info(`Retrieved ${jobs.length} jobs for user: ${auth0Id}`);
      return jobs;
    }

    // Fallback if no job history is found
    logger.warn(
      `No job history found for user: ${auth0Id}. Attempting to retrieve jobs directly from 'results' collection.`
    );

    // Fallback to querying the results collection directly for older records or users without job_history
    const snapshot = await db
      .collection("results")
      .where("auth0Id", "==", auth0Id)
      .orderBy("createdAt", "desc")
      .get();

    if (snapshot.empty) {
      logger.info(
        `No jobs found for user: ${auth0Id} in 'results' collection.`
      );
      return [];
    }

    // Convert the snapshot to an array of job objects
    const jobs = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        jobId: doc.id,
        status: data.status,
        analysisName: data.analysisName || "Unnamed Analysis",
        createdAt: data.createdAt ? data.createdAt.toDate() : null,
        updatedAt: data.updatedAt ? data.updatedAt.toDate() : null,
        // Don't include the full result data to keep the response size small
        hasResults: !!data.resultData,
      };
    });

    logger.info(`Retrieved ${jobs.length} jobs for user: ${auth0Id}`);
    return jobs;
  } catch (error) {
    logger.error(`Error retrieving jobs for user: ${auth0Id}:`, error);
    return [];
  }
};

export default {
  storeResults,
  getResults,
  updateJobStatus,
  getUserJobs,
  addResults,
};
