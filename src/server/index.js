import express from "express";
import cors from "cors";
import zlib from "zlib";
import { auth } from "express-oauth2-jwt-bearer";
import { loggerMiddleware } from "./middleware/loggerMiddleware.js";
import { apiUrlFor } from "./utilities/apiUtils.js";
import { AuthVariables, SystemVariables } from "./constants/envConstants.js";
import uploadApi from "./controllers/uploadController.js";
import resultsApi from "./controllers/resultsController.js";
import logger from "./utilities/loggerUtils.js";
import firebaseUtils from "./utilities/firebaseUtils.js";
import similarityApi from "./controllers/similarityController.js";

import {
  UnauthorizedException,
  HttpRequestException,
} from "./types/exceptions.js";
import { ErrorContent } from "./types/errorContent.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Increase limit to 10MB
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// JWT Authentication Middleware
const checkJwt = auth({
  audience: AuthVariables.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${AuthVariables.AUTH0_DOMAIN}/`,
});

// Error handler for invalid or expired JWT
const jwtErrorHandler = (err, req, res, next) => {
  if (err.name === "UnauthorizedError") {
    const customError = new UnauthorizedException(
      "Invalid or missing token. Please provide a valid JWT token.",
      "INVALID_JWT_TOKEN"
    );

    const errorContent = ErrorContent.convertFromException(customError);
    return res.status(errorContent.status).json(errorContent.getSummary());
  }
  next(err);
};

app.use(loggerMiddleware);
app.use(express.json());

// Create a separate router for the update endpoint that doesn't require JWT authentication
const updateRouter = express.Router();
updateRouter.post("/update", async (req, res, next) => {
  try {
    const { jobId, status } = req.body;
    let { resultData } = req.body; // resultData is optional

    if (!jobId) {
      logger.warn("No job ID provided");
      return next(
        new HttpRequestException(400, "Job ID is required", "MISSING_JOB_ID")
      );
    }

    if (!status) {
      logger.warn("No status provided");
      return next(
        new HttpRequestException(400, "Status is required", "MISSING_STATUS")
      );
    }

    // Get the current job data
    const jobData = await firebaseUtils.getResults(jobId);

    if (!jobData) {
      logger.warn(`No job found for job ID: ${jobId}`);
      return next(
        new HttpRequestException(404, "Job not found", "JOB_NOT_FOUND")
      );
    }

    // Update the job status
    await firebaseUtils.updateJobStatus(jobId, status);
    logger.info(`Updated job status for job ID: ${jobId} to ${status}`);

    // If result data is provided, update the existing job with the result data
    if (resultData && status === "completed") {
      // Get the document reference
      await firebaseUtils.addResults(jobId, resultData);

      logger.info(`Updated results for job ID: ${jobId}`);
    }

    return res.json({
      message: "Job updated successfully",
      jobId,
      status,
    });
  } catch (error) {
    logger.error("Error updating job:", error);
    next(error);
  }
});

// Mount the update router before JWT authentication
app.use(apiUrlFor("results"), updateRouter);

// Use the checkJwt middleware to protect all other routes
app.use(checkJwt);
app.use(jwtErrorHandler);

app.use(apiUrlFor("upload"), uploadApi);
app.use(apiUrlFor("results"), resultsApi);
app.use(apiUrlFor("similarity"), similarityApi);

app.use((err, req, res, next) => {
  const errorContent = ErrorContent.convertFromException(err);
  res.status(errorContent.status).json(errorContent.getSummary());
});

app.listen(SystemVariables.PORT, () => {
  console.log("Server listening on port", SystemVariables.PORT);
});

export default app;
