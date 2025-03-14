import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

/**
 * Checks if an origin is allowed based on the CORS_ORIGIN environment variable
 * Supports both the exact match and the special case of the email subdomain
 */
const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) {
    console.log('[CORS] No origin header present, allowing request');
    return true; // Allow requests with no origin header (non-CORS)
  }
  
  console.log(`[CORS] Checking origin: ${origin} against CORS_ORIGIN: ${env.CORS_ORIGIN}`);
  
  // If CORS_ORIGIN is set to wildcard, allow all origins
  if (env.CORS_ORIGIN === '*') {
    console.log('[CORS] Wildcard origin allowed');
    return true;
  }
  
  // Direct match with the configured CORS_ORIGIN
  if (origin === env.CORS_ORIGIN) {
    console.log('[CORS] Direct match allowed');
    return true;
  }
  
  try {
    // Extract domains for comparison
    const originDomain = new URL(origin).hostname;
    
    // Handle various CORS_ORIGIN formats (with or without protocol)
    const configDomain = env.CORS_ORIGIN.includes('://')
      ? new URL(env.CORS_ORIGIN).hostname
      : env.CORS_ORIGIN;
      
    console.log(`[CORS] Comparing: ${originDomain} with ${configDomain}`);
    
    // Check for domain and its email subdomain
    const domainWithoutSubdomain = originDomain.replace(/^(?:email\.)?/, '');
    const configDomainWithoutSubdomain = configDomain.replace(/^(?:email\.)?/, '');
    
    // Check if main domains match (ignoring email. prefix)
    if (domainWithoutSubdomain === configDomainWithoutSubdomain) {
      console.log('[CORS] Main domain match allowed');
      return true;
    }
    
    // Check if one is the email subdomain of the other
    if (
      // Check if origin is email.domain and configured is domain
      (originDomain === `email.${configDomain}`) ||
      // Check if configured is email.domain and origin is domain
      (configDomain === `email.${originDomain}`)
    ) {
      console.log('[CORS] Email subdomain pattern match allowed');
      return true;
    }
  } catch (e) {
    // If URL parsing fails, just return false
    console.log(`[CORS] URL parsing error: ${e}`);
    return false;
  }
  
  console.log('[CORS] Origin not allowed');
  return false;
};

/**
 * Special middleware to handle CORS between main domain and email subdomain
 * Allows bidirectional communication between a domain and its email subdomain
 */
export const corsHandler = (req: Request, res: Response, next: NextFunction): void => {
  // Ensure we get the origin header, supporting both Express and our custom WorkerRequest
  let origin: string | undefined;
  
  // Check if we have an Express-style headers object or a WorkerRequest
  if (typeof req.headers === 'object' && !('get' in req.headers)) {
    // Express Request
    origin = req.headers.origin;
  } else if (typeof req.get === 'function') {
    // WorkerRequest with get method
    origin = req.get('origin') || undefined;
  } else if (req.headers && typeof (req.headers as any).get === 'function') {
    // Direct Headers object
    origin = (req.headers as any).get('origin') || undefined;
  } else if ('header' in req && typeof (req as any).header === 'function') {
    // Express-like header function
    origin = (req as any).header('origin');
  }
  
  console.log(`[CORS] Request from origin: ${origin || 'undefined'}, method: ${req.method}`);
  console.log(`[CORS] Headers type: ${typeof req.headers}`);
  
  // Always set CORS headers for OPTIONS requests
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Handling OPTIONS preflight request');
    
    if (origin && isOriginAllowed(origin)) {
      console.log('[CORS] Setting headers for allowed origin');
      // Set CORS headers for preflight requests
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Access-Control-Max-Age', '86400');
      
      // Return 204 No Content for preflight requests
      res.status(204).end();
      return;
    } else {
      console.log('[CORS] Origin not allowed for OPTIONS');
      res.status(403).json({ error: 'CORS not allowed for this origin' });
      return;
    }
  }
  
  // For actual requests, check if the origin is allowed or not present (direct request)
  if (isOriginAllowed(origin)) {
    if (origin) {
      console.log('[CORS] Setting headers for regular request');
      // Set CORS headers to allow the request
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'POST');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
    } else {
      console.log('[CORS] Non-CORS request (no origin) allowed to proceed');
    }
    next();
  } else {
    console.log('[CORS] Origin not allowed, but allowing non-CORS request to proceed');
    next();
  }
}; 