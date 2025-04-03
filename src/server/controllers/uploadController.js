import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import archiver from "archiver";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import firebaseUtils from "../utilities/firebaseUtils.js";
import awsUtils from "../utilities/awsUtils.js";
import { getAuth0UserId } from "../middleware/authMiddleware.js";

// Import your environment, logger, and custom exceptions
import { EmailVariables } from "../constants/envConstants.js";
import logger from "../utilities/loggerUtils.js";
import { BadRequestException } from "../types/exceptions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatePath = path.join(
  __dirname,
  "..",
  "templates",
  "similarityResultsTemplate.html"
);

const router = express.Router();
export default router;

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EmailVariables.EMAIL_USER,
    pass: EmailVariables.EMAIL_PASS,
  },
});

/**
 * Helper function that converts a stream into a Buffer.
 * @param {Stream} stream - The readable stream.
 * @returns {Promise<Buffer>} - A promise that resolves with the Buffer.
 */
function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", (err) => reject(err));
  });
}

router.post("/", multer().any(), async (req, res, next) => {
  try {
    const auth0Id = await getAuth0UserId(req);

    if (!auth0Id) {
      logger.warn("No sub claim found in the Auth0 token payload");
      throw new BadRequestException(
        "No user ID found in token payload.",
        "NO_USER_ID_CLAIM"
      );
    }

    const analysisName = req.body.analysisName;

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      logger.warn("No files found in request");
      throw new BadRequestException("No files uploaded.", "NO_FILES_UPLOADED");
    }

    // Generate a unique job ID
    const jobId = uuidv4();

    // Create a pending job in Firebase
    await firebaseUtils.storeResults(auth0Id, jobId, null, analysisName);
    await firebaseUtils.updateJobStatus(jobId, "pending");
    logger.info(
      `Created pending job in Firebase with job ID: ${jobId} and analysis name: ${analysisName}`
    );

    // Create a zip archive of the files
    const archive = archiver("zip", { zlib: { level: 9 } });
    req.files.forEach((file) => {
      archive.append(file.buffer, { name: file.originalname });
    });
    archive.finalize();

    // Wait until the archive stream is fully converted into a Buffer
    const zipBuffer = await streamToBuffer(archive);

    // Upload the zip file to S3
    const s3Key = `uploads/${auth0Id}/${jobId}.zip`;
    await awsUtils.uploadToS3(zipBuffer, s3Key);
    logger.info(`Uploaded zip file to S3: ${s3Key}`);

    // Send a message to SQS
    await awsUtils.sendToSQS(jobId, s3Key, auth0Id, analysisName);
    logger.info(`Sent job to SQS queue: ${jobId}`);

    // Return the job ID to the frontend
    return res.json({
      message: "Job submitted successfully!",
      jobId,
      status: "pending",
    });
  } catch (error) {
    logger.error("Error processing upload:", error);
    next(error);
  }
});
