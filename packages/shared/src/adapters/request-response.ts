/**
 * Common interface that can be implemented for both Worker and Express environments
 * These interfaces provide a unified API regardless of the underlying platform
 */

// Type alias for header values
export type HeadersRecord = Record<string, string | string[] | number | undefined>;

export interface CommonRequest {
  method: string;
  url: string;
  path: string;
  ip: string;
  headers: HeadersRecord;
  body: any;
  query: Record<string, string>;
  params: Record<string, string>;
  
  // Method to get a header (matches Express API)
  get(name: string): string | undefined;
  
  // Method to get original request if needed
  getOriginalRequest(): any;
}

/**
 * Common response interface for cross-environment compatibility
 * Implementations can adapt this to platform-specific response objects
 */
export interface CommonResponse {
  statusCode: number;
  headers: HeadersRecord;
  body: any;
  
  // Method to set status code
  status(code: number): CommonResponse;
  
  // Method to send JSON response
  json(data: any): CommonResponse;
  
  // Method to set headers
  set(name: string, value: string): CommonResponse;
  set(headers: Record<string, string>): CommonResponse;
  
  // Deliver the response to the client
  send(): any;
  
  // Event handling for finish
  on(event: string, callback: Function): void;
}
