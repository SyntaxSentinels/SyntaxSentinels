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
import JSZip from "jszip";
import { Buffer } from 'buffer';

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

const MAX_FILES = 500;

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
    stream.on("error", reject);
  });
}

function isPythonFile(filename) {
  return filename.toLowerCase().endsWith('.py');
}

function isZipFile(filename) {
  return filename.toLowerCase().endsWith('.zip');
}

/**
 * Validates the uploaded files before processing
 * @param {Array} files - Array of uploaded files
 * @throws {BadRequestException} - If validation fails
 */
async function validateUploadedFiles(files) {
  // Check the type and number of files
  // We accept either a single zip file, or multiple python files.
  // Nothing else should be allowed.

  // Check if no files were uploaded
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new BadRequestException("No files uploaded.", "NO_FILES_UPLOADED");
  }

  // Check that there is no mix of file extensions
  const hasPythonFiles = files.some(file => isPythonFile(file.originalname));
  const hasZipFiles = files.some(file => isZipFile(file.originalname));
  if (hasPythonFiles === hasZipFiles) {
    throw new BadRequestException("Please upload either a zip file or python files, not both.", "MIXED_FILE_TYPES");
  }
  let fileCount = files.length;
  let fileNames = files.map(file => file.originalname);
  if (hasZipFiles) {
    // Check that there is only one zip file
    if (files.length !== 1) {
      throw new BadRequestException("Please upload exactly one zip file.", "INVALID_ZIP_FILE");
    }
    // Check that everything inside the zip is a python file
    // Catch unzipping errors and throw it with a message about an invalid zip file
    let result = null;
    try {
      const zip = new JSZip();
      result = await zip.loadAsync(files[0].buffer)
    } catch (error) {
      throw new BadRequestException("Potentially corrupted zip file.", "CORRUPTED_ZIP_FILE");
    }
    const pythonFilesinZip = Object.keys(result.files).filter(file => isPythonFile(file));
    if (pythonFilesinZip.length !== Object.keys(result.files).length) {
      throw new BadRequestException("Please upload a zip file containing only python files.", "INVALID_ZIP_FILE");
    }
    fileCount = pythonFilesinZip.length;
    fileNames = pythonFilesinZip;
  }

  // Disallow duplicate file names
  const uniqueFileNames = new Set(fileNames);
  if (uniqueFileNames.size !== fileNames.length) {
    throw new BadRequestException("Please upload unique file names.", "DUPLICATE_FILE_NAMES");
  }

  if (fileCount > MAX_FILES) {
    throw new BadRequestException(`Please upload less than ${MAX_FILES} files.`, "TOO_MANY_FILES_UPLOADED");
  }
  if (fileCount <= 1) {
    throw new BadRequestException("Please upload at least 2 python files.", "TOO_FEW_FILES_UPLOADED");
  }
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
    if (!analysisName || typeof analysisName !== 'string' || analysisName.trim().length === 0) {
      throw new BadRequestException(
        "Analysis name is required and must be a non-empty string.",
        "INVALID_ANALYSIS_NAME"
      );
    }

    // Validate files before any database operations
    await validateUploadedFiles(req.files);

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
    if (error instanceof BadRequestException) {
      return res.status(400).json({
        message: error.message,
        code: error.code
      });
    }
    next(error);
  }
});
