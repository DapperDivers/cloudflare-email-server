// Re-export the request-response functionality from the shared package
export type {
  CommonRequest,
  CommonResponse,
  HeadersRecord,
} from 'shared/adapters/request-response';

// Express-specific adapter implementation
import { Request, Response } from 'express';

import type {
  CommonRequest,
  CommonResponse,
  HeadersRecord,
} from 'shared/adapters/request-response';

/**
 * Express-specific request adapter
 */
export class ExpressRequestAdapter implements Partial<CommonRequest> {
  private req: Request;

  constructor(req: Request) {
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

  get headers(): HeadersRecord {
    return this.req.headers as HeadersRecord;
  }

  get body(): unknown {
    return this.req.body;
  }

  get ip(): string {
    return this.req.ip || '';
  }

  get params(): Record<string, string> {
    return this.req.params;
  }

  get query(): Record<string, string> {
    return this.req.query as Record<string, string>;
  }

  get(name: string): string | undefined {
    return this.headers[name]?.toString();
  }

  getOriginalRequest(): Request {
    return this.req;
  }
}

/**
 * Express-specific response adapter
 */
export class ExpressResponseAdapter {
  private res: Response;
  public statusCode: number = 200;
  public headers: HeadersRecord = {};
  public body: any = null;

  constructor(res: Response) {
    this.res = res;
  }

  status(code: number): ExpressResponseAdapter {
    this.statusCode = code;
    this.res.status(code);
    return this;
  }

  set(name: string, value: string): ExpressResponseAdapter {
    this.headers[name] = value;
    this.res.setHeader(name, value);
    return this;
  }

  setHeader(name: string, value: string): ExpressResponseAdapter {
    return this.set(name, value);
  }

  json(data: any): ExpressResponseAdapter {
    this.body = data;
    this.res.json(data);
    return this;
  }

  send(data: any): ExpressResponseAdapter {
    this.body = data;
    this.res.send(data);
    return this;
  }

  on(event: string, callback: (...args: any[]) => void): ExpressResponseAdapter {
    this.res.on(event, callback);
    return this;
  }
}
