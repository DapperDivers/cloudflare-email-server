import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

/**
 * Checks if an origin is allowed based on the CORS_ORIGIN environment variable
 * Supports both the exact match and the special case of the email subdomain
 */
const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return false;
  
  // Direct match with the configured CORS_ORIGIN
  if (origin === env.CORS_ORIGIN) return true;
  
  try {
    // Handle the special case of domain.com <-> email.domain.com
    const originUrl = new URL(origin);
    const configuredUrl = new URL(env.CORS_ORIGIN);
    
    // Check if one is the email subdomain of the other
    if (
      // Check if origin is email.domain and configured is domain
      (originUrl.hostname === `email.${configuredUrl.hostname}`) ||
      // Check if configured is email.domain and origin is domain
      (configuredUrl.hostname === `email.${originUrl.hostname}`)
    ) {
      return true;
    }
  } catch (e) {
    // If URL parsing fails, just return false
    return false;
  }
  
  return false;
};

/**
 * Special middleware to handle CORS between main domain and email subdomain
 * Allows bidirectional communication between a domain and its email subdomain
 */
export const corsHandler = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.headers.origin;
  
  // For preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    if (origin && isOriginAllowed(origin)) {
      // Set CORS headers for preflight requests
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Access-Control-Max-Age', '86400');
      
      // Return 204 No Content for preflight requests
      res.status(204).end();
      return;
    }
  }
  
  // For actual requests, check if the origin is allowed
  if (origin && isOriginAllowed(origin)) {
    // Set CORS headers to allow the request
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
  }
  
  next();
}; 