// controllers/similarityController.js
import express from "express";
import { compareTwoFiles } from "../algorithm/tokenizer.js";
import { HttpRequestException } from "../types/exceptions.js";
import logger from "../utilities/loggerUtils.js";
import { getAuth0UserId } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/compare", async (req, res, next) => {
  try {
    await getAuth0UserId(req);
    const {
      file1Content,
      file2Content,
      file1Name, // Optional name
      file2Name, // Optional name
    } = req.body;

    // --- Basic Input Validation ---
    if (!file1Content || !file2Content) {
      logger.warn("Missing file content in /compare request");
      return next(
        new HttpRequestException(
          400,
          "Both file1Content and file2Content are required.",
          "MISSING_CONTENT"
        )
      );
    }
    if (typeof file1Content !== "string" || typeof file2Content !== "string") {
      logger.warn("Invalid file content type in /compare request");
      return next(
        new HttpRequestException(
          400,
          "File content must be strings.",
          "INVALID_CONTENT_TYPE"
        )
      );
    }


    // --- Perform Comparison ---
    logger.info(
      `Starting similarity comparison between ${file1Name || "file1"} and ${
        file2Name || "file2"
      }`
    );
    const result = compareTwoFiles(
      file1Content,
      file2Content,
      file1Name,
      file2Name
    );
    logger.info(`Comparison finished. Score: ${result.similarity_score}`);

    // --- Send Response ---
    res.json(result);
  } catch (error) {
    logger.error("Error during similarity comparison:", error);
    // Pass error to the generic error handler in app.js
    next(error);
  }
});

export default router;
