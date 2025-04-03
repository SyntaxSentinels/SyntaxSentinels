import express from "express";
import logger from "../utilities/loggerUtils.js";
import { HttpRequestException } from "../types/exceptions.js";
import firebaseUtils from "../utilities/firebaseUtils.js";
import { getAuth0UserId } from "../middleware/authMiddleware.js";

const router = express.Router();
export default router;

/**
 * GET /results
 * Get all jobs for the current user
 */
router.get("/", async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const auth0Id = await getAuth0UserId(req);

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
    const auth0Id = await getAuth0UserId(req);

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

export { router };
