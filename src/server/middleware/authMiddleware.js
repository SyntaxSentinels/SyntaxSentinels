import { AuthVariables } from "../constants/envConstants.js";
import logger from "../utilities/loggerUtils.js";
import { HttpRequestException } from "../types/exceptions.js";

const userDataCache = new Map();

// Time in milliseconds (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

/**
 * Fetch user data from Auth0 with caching
 * @param {string} token - The JWT token
 * @returns {Promise<Object>} - The user data
 */
export async function fetchUserDataFromAuth0(token) {
  // Check if we have cached data for this token
  const cachedData = userDataCache.get(token);
  if (cachedData && cachedData.expiresAt > Date.now()) {
    logger.info("Using cached Auth0 user data");
    return cachedData.data;
  }

  // If not in cache or expired, fetch from Auth0
  logger.info("Fetching user data from Auth0");
  const response = await fetch(
    `https://${AuthVariables.AUTH0_DOMAIN}/userinfo`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    logger.error(`Auth0 API error: ${response.status} ${response.statusText}`);
    throw new HttpRequestException(
      response.status,
      "Failed to fetch user info",
      "AUTH0_USER_FETCH_ERROR"
    );
  }

  const userData = await response.json();
  
  userDataCache.set(token, {
    data: userData,
    expiresAt: Date.now() + CACHE_EXPIRATION
  });
  
  return userData;
}

/**
 * Get the Auth0 user ID from the request
 * @param {Object} req - The Express request object
 * @returns {Promise<string>} - The Auth0 user ID
 */
export async function getAuth0UserId(req) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      throw new HttpRequestException(
        401,
        "Missing or invalid token",
        "INVALID_TOKEN"
      );
    }

    const userData = await fetchUserDataFromAuth0(token);
    const auth0Id = userData.sub; // Auth0 ID is in the 'sub' claim

    if (!auth0Id) {
      logger.warn("No sub claim found in the Auth0 token payload");
      throw new HttpRequestException(
        400,
        "No user ID found in token payload",
        "NO_USER_ID_CLAIM"
      );
    }

    return auth0Id;
  } catch (error) {
    logger.error("Error fetching Auth0 user ID:", error);
    throw error;
  }
}
