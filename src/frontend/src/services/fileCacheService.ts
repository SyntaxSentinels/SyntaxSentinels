/**
 * File Cache Service
 * 
 * This service provides functionality to cache files in the browser's localStorage
 * and retrieve them when needed. It also handles file hashing to identify files.
 */

// Interface for cached file entry
interface CachedFile {
  name: string;
  content: string;
  hash: string;
  timestamp: number;
}

// Cache key in localStorage
const FILE_CACHE_KEY = 'syntax-sentinels-file-cache';

/**
 * Generate a simple hash for a file
 * @param content File content as string
 * @returns Hash string
 */
export const generateFileHash = (content: string): string => {
  let hash = 0;
  if (content.length === 0) return hash.toString();
  
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return hash.toString(16);
};

/**
 * Cache a file in localStorage
 * @param file File object
 * @returns Promise that resolves to the file hash
 */
export const cacheFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const hash = generateFileHash(content);
        
        // Get existing cache
        const cacheString = localStorage.getItem(FILE_CACHE_KEY) || '{}';
        const cache = JSON.parse(cacheString);
        
        // Add file to cache
        cache[file.name] = {
          name: file.name,
          content,
          hash,
          timestamp: Date.now()
        };
        
        // Save cache
        localStorage.setItem(FILE_CACHE_KEY, JSON.stringify(cache));
        
        resolve(hash);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
};

/**
 * Cache multiple files in localStorage
 * @param files Array of File objects
 * @returns Promise that resolves to an array of file hashes
 */
export const cacheFiles = async (files: File[]): Promise<string[]> => {
  const promises = files.map(file => cacheFile(file));
  return Promise.all(promises);
};

/**
 * Get a file from cache by name
 * @param fileName Name of the file
 * @returns File content as string or null if not found
 */
export const getFileFromCache = (fileName: string): string | null => {
  try {
    const cacheString = localStorage.getItem(FILE_CACHE_KEY) || '{}';
    const cache = JSON.parse(cacheString);
    
    if (cache[fileName]) {
      return cache[fileName].content;
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving file from cache:', error);
    return null;
  }
};

/**
 * Get a file from cache by hash
 * @param fileHash Hash of the file
 * @returns File content as string or null if not found
 */
export const getFileFromCacheByHash = (fileHash: string): string | null => {
  try {
    const cacheString = localStorage.getItem(FILE_CACHE_KEY) || '{}';
    const cache = JSON.parse(cacheString);
    
    for (const fileName in cache) {
      if (cache[fileName].hash === fileHash) {
        return cache[fileName].content;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving file from cache by hash:', error);
    return null;
  }
};

/**
 * Clear the file cache
 */
export const clearFileCache = (): void => {
  localStorage.removeItem(FILE_CACHE_KEY);
};

/**
 * Get all cached files
 * @returns Object with file names as keys and CachedFile objects as values
 */
export const getAllCachedFiles = (): Record<string, CachedFile> => {
  try {
    const cacheString = localStorage.getItem(FILE_CACHE_KEY) || '{}';
    return JSON.parse(cacheString);
  } catch (error) {
    console.error('Error retrieving all cached files:', error);
    return {};
  }
};
