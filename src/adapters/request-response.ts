import { Request as ExpressRequest, Response as ExpressResponse } from 'express';

// Common interface that can be implemented for both Worker and Express environments
export interface CommonRequest {
  method: string;
  url: string;
  path: string;
  ip: string;
  headers: Record<string, string | string[] | undefined>;
  body: any;
  query: Record<string, string>;
  params: Record<string, string>;
  
  // Method to get a header (matches Express API)
  get(name: string): string | undefined;
  
  // Method to get original request if needed
  getOriginalRequest(): any;
}

export interface CommonResponse {
  statusCode: number;
  headers: Record<string, string | string[] | number | undefined>;
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

// Express adapter implementations
export class ExpressRequestAdapter implements CommonRequest {
  private req: ExpressRequest;

  constructor(req: ExpressRequest) {
    this.req = req;
  }

  get method(): string {
    return this.req.method;
  }

  get url(): string {
    return this.req.url;
  }

  get path(): string {
    return this.req.path;
  }

  get ip(): string {
    return this.req.ip || 'unknown';
  }

  get headers(): Record<string, string | string[] | undefined> {
    return this.req.headers;
  }

  get body(): any {
    return this.req.body;
  }

  get query(): Record<string, string> {
    return this.req.query as Record<string, string>;
  }

  get params(): Record<string, string> {
    return this.req.params;
  }

  get(name: string): string | undefined {
    return this.req.get(name);
  }

  getOriginalRequest(): any {
    return this.req;
  }
}

export class ExpressResponseAdapter implements CommonResponse {
  private res: ExpressResponse;

  constructor(res: ExpressResponse) {
    this.res = res;
  }

  get statusCode(): number {
    return this.res.statusCode;
  }

  set statusCode(code: number) {
    this.res.statusCode = code;
  }

  get headers(): Record<string, string | string[] | number | undefined> {
    return this.res.getHeaders();
  }

  get body(): any {
    return this.res.locals.body;
  }

  set body(data: any) {
    this.res.locals.body = data;
  }

  status(code: number): CommonResponse {
    this.res.status(code);
    return this;
  }

  json(data: any): CommonResponse {
    this.body = data;
    this.res.json(data);
    return this;
  }

  set(name: string | Record<string, string>, value?: string): CommonResponse {
    if (typeof name === 'string' && value !== undefined) {
      this.res.set(name, value);
    } else if (typeof name === 'object') {
      this.res.set(name);
    }
    return this;
  }

  send(): any {
    return this.res;
  }

  on(event: string, callback: Function): void {
    this.res.on(event, callback as any);
  }
}

// Worker adapter implementations
export class WorkerRequestAdapter implements CommonRequest {
  private request: Request;
  private _body: any;
  private _url: URL;
  private headersObj: Record<string, string | string[] | undefined>;
  private _query: Record<string, string>;
  private _params: Record<string, string>;

  constructor(request: Request, body: any = null) {
    this.request = request;
    this._body = body;
    this._url = new URL(request.url);
    
    // Convert headers to plain object
    this.headersObj = {};
    request.headers.forEach((value, key) => {
      this.headersObj[key.toLowerCase()] = value;
    });
    
    // Parse query params
    this._query = {};
    this._url.searchParams.forEach((value, key) => {
      this._query[key] = value;
    });
    
    this._params = {};
  }

  get method(): string {
    return this.request.method;
  }

  get url(): string {
    return this.request.url;
  }

  get path(): string {
    return this._url.pathname;
  }

  get ip(): string {
    return this.request.headers.get('CF-Connecting-IP') || 'unknown';
  }

  get headers(): Record<string, string | string[] | undefined> {
    return this.headersObj;
  }

  get body(): any {
    return this._body;
  }

  get query(): Record<string, string> {
    return this._query;
  }

  get params(): Record<string, string> {
    return this._params;
  }

  get(name: string): string | undefined {
    return this.request.headers.get(name) || undefined;
  }

  getOriginalRequest(): any {
    return this.request;
  }
}

export class WorkerResponseAdapter implements CommonResponse {
  private _statusCode: number = 200;
  private _headers: Record<string, string | string[] | number | undefined> = {
    'Content-Type': 'application/json',
  };
  private _body: any = null;
  private listeners: Record<string, Function[]> = {};

  constructor() {
    this.listeners = {};
  }

  get statusCode(): number {
    return this._statusCode;
  }

  set statusCode(code: number) {
    this._statusCode = code;
  }

  get headers(): Record<string, string | string[] | number | undefined> {
    return this._headers;
  }

  get body(): any {
    return this._body;
  }

  set body(data: any) {
    this._body = data;
  }

  status(code: number): CommonResponse {
    this._statusCode = code;
    return this;
  }

  json(data: any): CommonResponse {
    this._body = data;
    this.emit('finish');
    return this;
  }

  set(name: string | Record<string, string>, value?: string): CommonResponse {
    if (typeof name === 'string' && value !== undefined) {
      this._headers[name] = value;
    } else if (typeof name === 'object') {
      this._headers = { ...this._headers, ...name };
    }
    return this;
  }

  send(): Response {
    // Convert headers to a format compatible with Response
    const headers: Record<string, string> = {};
    Object.entries(this._headers).forEach(([key, value]) => {
      if (value !== undefined) {
        headers[key] = String(value);
      }
    });
    
    const response = new Response(
      JSON.stringify(this._body),
      {
        status: this._statusCode,
        headers,
      }
    );
    
    this.emit('finish');
    return response;
  }

  on(event: string, callback: Function): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event: string, ...args: any[]): void {
    if (this.listeners[event]) {
      for (const callback of this.listeners[event]) {
        callback(...args);
      }
    }
  }
} 