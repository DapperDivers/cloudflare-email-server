import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { CommonRequest, CommonResponse, HeadersRecord } from 'shared/src/adapters/request-response';

/**
 * Express-specific implementation of the CommonRequest interface
 */
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

  get headers(): HeadersRecord {
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

/**
 * Express-specific implementation of the CommonResponse interface
 */
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

  get headers(): HeadersRecord {
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