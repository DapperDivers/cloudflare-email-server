declare module 'hpp' {
  import { RequestHandler } from 'express';

  function hpp(): RequestHandler;
  export = hpp;
}
