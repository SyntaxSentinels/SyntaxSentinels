import express from "express";
import { v4 as uuidv4 } from "uuid";
import logger from "../utilities/loggerUtils.js";
import { HttpRequestException } from "../types/exceptions.js";
import firebaseUtils from "../utilities/firebaseUtils.js";
import { AuthVariables } from "../constants/envConstants.js";
import { fetchUserDataFromAuth0 } from "../middleware/authMiddleware.js";

const router = express.Router();
export default router;

/**
 * GET /results
 * Get all jobs for the current user
 */
router.get("/", async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return next(
        new HttpRequestException(
          400,
          "Authorization token missing",
          "MISSING_TOKEN"
        )
      );
    }

    // Fetch user data from Auth0
    const userData = await fetchUserDataFromAuth0(token);
    const auth0Id = userData?.sub;

    if (!auth0Id) {
      logger.warn("No 'sub' claim found in the Auth0 token payload");
      return next(
        new HttpRequestException(
          400,
          "No user ID found in token payload",
          "NO_USER_ID_CLAIM"
        )
      );
    }

    // Fetch user jobs from Firebase
    const jobs = await firebaseUtils.getUserJobs(auth0Id);

    // Return an empty array if no jobs are found
    return res.json({ jobs: jobs || [] });
  } catch (error) {
    logger.error("Error retrieving user jobs:", error);
    return next(error);
  }
});

/**
 * GET /results/:jobId
 * Retrieve results for a specific job ID
 */
router.get("/:jobId", async (req, res, next) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      logger.warn("No job ID provided");
      return next(
        new HttpRequestException(400, "Job ID is required", "MISSING_JOB_ID")
      );
    }

    // Get the results from Firebase
    const results = await firebaseUtils.getResults(jobId);

    if (!results) {
      logger.warn(`No results found for job ID: ${jobId}`);
      return next(
        new HttpRequestException(404, "Results not found", "RESULTS_NOT_FOUND")
      );
    }

    // Check if the user is authorized to access these results
    const token = req.headers.authorization.split(" ")[1];
    const response = await fetch(
      `https://${AuthVariables.AUTH0_DOMAIN}/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const userData = await response.json();
    const auth0Id = userData.sub; // Auth0 ID is in the 'sub' claim

    if (results.auth0Id !== auth0Id) {
      logger.warn(
        `Unauthorized access attempt for job ID: ${jobId} by user: ${auth0Id}`
      );
      return next(
        new HttpRequestException(
          403,
          "Unauthorized access",
          "UNAUTHORIZED_ACCESS"
        )
      );
    }

    // Return the results
    return res.json({
      jobId,
      status: results.status,
      resultData: results.resultData,
    });
  } catch (error) {
    logger.error("Error retrieving results:", error);
    next(error);
  }
});

// /**
//  * POST /results/create
//  * Create a new job and return the job ID
//  */
// router.post("/create", async (req, res, next) => {
//   try {
//     // Generate a unique job ID
//     const jobId = uuidv4();

//     // Get user Auth0 ID from Auth0
//     const token = req.headers.authorization.split(" ")[1];
//     const response = await fetch(
//       `https://${AuthVariables.AUTH0_DOMAIN}/userinfo`,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       }
//     );
//     const userData = await response.json();
//     const auth0Id = userData.sub; // Auth0 ID is in the 'sub' claim

//     if (!auth0Id) {
//       logger.warn("No sub claim found in the Auth0 token payload");
//       return next(
//         new HttpRequestException(
//           400,
//           "No user ID found in token payload",
//           "NO_USER_ID_CLAIM"
//         )
//       );
//     }

//     // Get analysis name from request body
//     const { analysisName } = req.body;

//     // Create a pending job in Firebase
//     await firebaseUtils.storeResults(auth0Id, jobId, null, analysisName);

//     // Update the job status to pending
//     await firebaseUtils.updateJobStatus(jobId, "pending");

//     // Return the job ID
//     return res.json({
//       jobId,
//       status: "pending",
//       analysisName,
//     });
//   } catch (error) {
//     logger.error("Error creating job:", error);
//     next(error);
//   }
// });

// /**
//  * POST /results/update
//  * Update job status and results
//  * This endpoint is called by the Python server to update job status and store results
//  */
// router.post("/update", async (req, res, next) => {
//   try {
//     const { jobId, status, resultData } = req.body;

//     if (!jobId) {
//       logger.warn("No job ID provided");
//       return next(
//         new HttpRequestException(400, "Job ID is required", "MISSING_JOB_ID")
//       );
//     }

//     if (!status) {
//       logger.warn("No status provided");
//       return next(
//         new HttpRequestException(400, "Status is required", "MISSING_STATUS")
//       );
//     }

//     // Get the current job data
//     const jobData = await firebaseUtils.getResults(jobId);

//     if (!jobData) {
//       logger.warn(`No job found for job ID: ${jobId}`);
//       return next(
//         new HttpRequestException(404, "Job not found", "JOB_NOT_FOUND")
//       );
//     }

//     // Update the job status
//     await firebaseUtils.updateJobStatus(jobId, status);
//     logger.info(`Updated job status for job ID: ${jobId} to ${status}`);

//     // If result data is provided, store it
//     if (resultData && status === "completed") {
//       await firebaseUtils.storeResults(
//         jobData.auth0Id,
//         jobId,
//         resultData,
//         jobData.analysisName
//       );
//       logger.info(`Stored results for job ID: ${jobId}`);
//     }

//     return res.json({
//       message: "Job updated successfully",
//       jobId,
//       status,
//     });
//   } catch (error) {
//     logger.error("Error updating job:", error);
//     next(error);
//   }
// });

export { router };
