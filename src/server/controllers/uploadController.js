import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import nodemailer from "nodemailer";
import archiver from "archiver";
import multer from "multer";

// Import your environment, logger, and custom exceptions
import {
  EmailVariables,
  AuthVariables,
  SystemVariables,
} from "../constants/envConstants.js";
import logger from "../utilities/loggerUtils.js";
import {
  BadRequestException,
  HttpRequestException,
} from "../types/exceptions.js";

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
    const token = req.headers.authorization.split(" ")[1];
    const response = await fetch(
      `https://${AuthVariables.AUTH0_DOMAIN}/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const data = await response.json();
    const userEmail = data.email;

    if (!userEmail) {
      logger.warn("No email claim found in the Auth0 token payload");
      throw new BadRequestException(
        "No email claim found in token payload.",
        "NO_EMAIL_CLAIM"
      );
    }


    const analysisName = req.body.analysisName;

    const uploadDir = path.join(__dirname, "..", "files");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      logger.info(`Created directory: ${uploadDir}`);
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      logger.warn("No files found in request");
      throw new BadRequestException("No files uploaded.", "NO_FILES_UPLOADED");
    }

    const archive = archiver("zip", { zlib: { level: 9 } });
    req.files.forEach((file) => {
      archive.append(file.buffer, { name: file.originalname });
    });
    archive.finalize();

    // Wait until the archive stream is fully converted into a Buffer
    const zipBuffer = await streamToBuffer(archive);

    // Send the ZIP buffer to the Python API endpoint
    const pythonApiUrl = SystemVariables.PYTHON_API_URL;

    // log time it took to complete the request
    const start = new Date();
    const pythonResponse = await fetch(pythonApiUrl, {
      method: "POST",
      body: zipBuffer,
      headers: {
        "Content-Type": "application/zip",
      },
    });

    const end = new Date();
    const duration = end - start;
    logger.info(`Python API request took ${duration}ms`);

    if (!pythonResponse.ok) {
      const errorData = await pythonResponse.json();
      throw new Error(`Python API error: ${errorData.error}`);
    }

    const resultData = await pythonResponse.json();
    logger.info("Python API response:", pythonResponse.ok === true);

    const archiveResult = archiver("zip", { zlib: { level: 9 } });
    archiveResult.append(JSON.stringify(resultData), {
      name: "similarity_results.json",
    });
    archiveResult.finalize();

    const zipBufferResult = await streamToBuffer(archiveResult);

    // Send the email
    try {
      const info = await transporter.sendMail({
        from: '"Syntax Sentinels" <syntaxsentinals@gmail.com>',
        to: userEmail,
        subject: "SyntaxSentinels: Analysis Report",
        html: fs.readFileSync(templatePath, "utf8"),
        attachments: [
          {
            filename: `${analysisName}.zip`,
            content: zipBufferResult,
            contentType: "application/zip",
          },
        ],
      });

      const resultsJsonPath = path.join(
        __dirname,
        "../..",
        "similarity_results.json"
      );

      logger.info(`Email sent successfully to ${userEmail}: ${info.messageId}`);
      return res.json({
        message: "Email sent successfully!",
        info,
      });
    } catch (err) {
      logger.error("Error sending email:", err);
      return next(
        new HttpRequestException(500, err.message, "EMAIL_SENDING_ERROR")
      );
    }
  } catch (error) {
    logger.error("Error processing upload:", error);
    next(error);
  }
});
