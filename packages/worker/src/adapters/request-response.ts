import { CommonRequest, CommonResponse, HeadersRecord } from 'shared/src/adapters/request-response';

/**
 * Worker-specific implementation of the CommonRequest interface
 * This adapter allows Cloudflare Worker requests to work with our common interfaces
 */
export class WorkerRequestAdapter implements CommonRequest {
  private request: Request;
  private _body: any;
  private _url: URL;
  private headersObj: HeadersRecord;
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

  get headers(): HeadersRecord {
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

/**
 * Worker-specific implementation of the CommonResponse interface
 * This adapter allows our common response interface to be used with Cloudflare Workers
 */
export class WorkerResponseAdapter implements CommonResponse {
  private _statusCode: number = 200;
  private _headers: HeadersRecord = {
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

  get headers(): HeadersRecord {
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

    // Status codes that don't allow a body
    const nullBodyStatusCodes = [101, 204, 205, 304];

    // Create response with or without a body based on status code
    const response = nullBodyStatusCodes.includes(this._statusCode)
      ? new Response(null, {
          status: this._statusCode,
          headers,
        })
      : new Response(JSON.stringify(this._body), {
          status: this._statusCode,
          headers,
        });

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
