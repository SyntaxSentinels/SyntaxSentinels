import express from "express";
import awsUtils from "../utilities/awsUtils.js";
import firebaseUtils from "../utilities/firebaseUtils.js";
import { getAuth0UserId } from "../middleware/authMiddleware.js";
import logger from "../utilities/loggerUtils.js";
import { BadRequestException, NotFoundException } from "../types/exceptions.js";

const router = express.Router();
export default router;


/**
 * Get file contents for a specific job
 * @route GET /files/contents/:jobId
 */
router.get("/contents/:jobId", async (req, res, next) => {
  try {
    const auth0Id = await getAuth0UserId(req);
    const jobId = req.params.jobId;

    if (!auth0Id) {
      logger.warn("No sub claim found in the Auth0 token payload");
      throw new BadRequestException(
        "No user ID found in token payload.",
        "NO_USER_ID_CLAIM"
      );
    }

    if (!jobId) {
      logger.warn("No job ID provided");
      throw new BadRequestException("Job ID is required.", "MISSING_JOB_ID");
    }

    // Job data from Firebase used for auth
    const jobData = await firebaseUtils.getResults(jobId);
    if (!jobData) {
      logger.warn(`No job found for job ID: ${jobId}`);
      throw new NotFoundException("Job not found.", "JOB_NOT_FOUND");
    }
    // Authenticate
    if (jobData.auth0Id !== auth0Id) {
      logger.warn(`User ${auth0Id} attempted to access job ${jobId} owned by ${jobData.auth0Id}`);
      throw new BadRequestException("You don't have permission to access this job.", "UNAUTHORIZED_ACCESS");
    }

    const s3Key = `uploads/${auth0Id}/${jobId}.zip`;
    const fileBuffer = await awsUtils.getFileFromS3(s3Key);
    const extractedFiles = {};
    const zip = await import('jszip');
    const zipInstance = await zip.default.loadAsync(fileBuffer);
    
    for (const [filename, file] of Object.entries(zipInstance.files)) {
      if (!file.dir) {
        const content = await file.async("text");
        extractedFiles[filename] = content;
      }
    }
    
    return res.json(extractedFiles);
  } catch (error) {
    logger.error("Error retrieving file contents:", error);
    next(error);
  }
}); 