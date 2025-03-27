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

    const response = await fetch(
      `https://${AuthVariables.AUTH0_DOMAIN}/userinfo`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new HttpRequestException(
        response.status,
        "Failed to fetch user info",
        "AUTH0_USER_FETCH_ERROR"
      );
    }

    const userData = await response.json();
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
