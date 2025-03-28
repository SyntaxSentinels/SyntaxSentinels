import { AuthVariables } from "../constants/envConstants.js";

export async function fetchUserDataFromAuth0(token) {
  const response = await fetch(
    `https://${AuthVariables.AUTH0_DOMAIN}/userinfo`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch user data from Auth0");
  }

  return response.json();
}
