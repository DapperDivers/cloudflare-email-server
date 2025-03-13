import { Request, Response, NextFunction } from 'express';

export const logRequest = (req: Request, res: Response, next: NextFunction) => {
  const logData = {
    type: 'request',
    method: req.method,
    path: req.path,
    headers: req.headers,
    body: req.body
  };
  console.log(JSON.stringify(logData));
  next();
};

export const logResponse = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  res.send = function (body) {
    const logData = {
      type: 'response',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      headers: res.getHeaders()
    };
    console.log(JSON.stringify(logData));
    return originalSend.call(this, body);
  };
  next();
}; 