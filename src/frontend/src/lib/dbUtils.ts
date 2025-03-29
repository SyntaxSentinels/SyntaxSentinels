// src/utils/dbUtils.ts
import { openDB, DBSchema } from "idb";

const DB_NAME = "similarityDB"; // Use the actual name of your database
const STORE_NAME = "fileContentsStore"; // Use the actual name of your object store
const DB_VERSION = 1; // Increment if you change the schema

interface SimilarityDB extends DBSchema {
  [STORE_NAME]: {
    key: string; // Assuming jobId is the key
    value: Record<string, string>; // The object { "fileName": "content", ... }
  };
}

// Initialize the database and store if they don't exist
const dbPromise = openDB<SimilarityDB>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME); // Key is specified when adding/getting
      console.log(`Object store '${STORE_NAME}' created.`);
    }
  },
});

/**
 * Fetches the file contents object for a given job ID from IndexedDB.
 * @param jobId The job ID used as the key in IndexedDB.
 * @returns A Promise resolving to the file contents object (Record<string, string>) or null if not found.
 */
export const getFileContentsFromDB = async (
  jobId: string
): Promise<Record<string, string> | null> => {
  try {
    const db = await dbPromise;
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const contents = await store.get(jobId);
    await tx.done; // Ensure transaction completes
    return contents ?? null; // Return null if undefined
  } catch (error) {
    console.error(
      `Error fetching contents for job ${jobId} from IndexedDB:`,
      error
    );
    // Depending on requirements, you might want to throw or return null/empty object
    // Returning null indicates failure to fetch
    return null;
  }
};

/**
 * Saves the file contents object for a job ID to IndexedDB.
 * (You might call this elsewhere, e.g., after a successful upload/processing)
 * @param jobId The job ID to use as the key.
 * @param contents The file contents object (Record<string, string>).
 */
export const saveFileContentsToDB = async (
  jobId: string,
  contents: Record<string, string>
): Promise<void> => {
  try {
    const db = await dbPromise;
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await store.put(contents, jobId); // Put contents with jobId as key
    await tx.done;
    console.log(`Contents saved for job ${jobId} in IndexedDB.`);
  } catch (error) {
    console.error(
      `Error saving contents for job ${jobId} to IndexedDB:`,
      error
    );
    // Handle error appropriately (e.g., show message to user)
    throw error; // Re-throw to indicate failure
  }
};
