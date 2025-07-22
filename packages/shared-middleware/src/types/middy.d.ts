declare module '@middy/core' {
  import { Context } from 'aws-lambda';

  export interface Request<TEvent = unknown, TResult = unknown, TErr = Error, TContext = Context> {
    event: TEvent;
    context: TContext;
    response?: TResult | null;
    error?: TErr;
    internal: Record<string, unknown>;
  }

  export interface MiddlewareFn<TEvent = unknown, TResult = unknown> {
    (request: Request<TEvent, TResult>): void | Promise<void>;
  }

  export interface MiddlewareObj<TEvent = unknown, TResult = unknown> {
    before?: MiddlewareFn<TEvent, TResult>;
    after?: MiddlewareFn<TEvent, TResult>;
    onError?: MiddlewareFn<TEvent, TResult>;
  }

  export interface MiddyfiedHandler<TEvent = unknown, TResult = unknown> {
    (event: TEvent, context: Context): Promise<TResult>;
    use(middleware: MiddlewareObj<TEvent, TResult>): MiddyfiedHandler<TEvent, TResult>;
  }

  function middy<TEvent = unknown, TResult = unknown>(
    handler: (event: TEvent, context: Context) => Promise<TResult>
  ): MiddyfiedHandler<TEvent, TResult>;

  export default middy;
}

declare module '@middy/http-cors' {
  import { MiddlewareObj } from '@middy/core';
  import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

  interface CorsOptions {
    origin?: string | boolean;
    headers?: string;
    credentials?: boolean;
    maxAge?: number;
  }

  function httpCors(
    options?: CorsOptions
  ): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult>;
  export default httpCors;
}

declare module '@middy/http-event-normalizer' {
  import { MiddlewareObj } from '@middy/core';
  import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

  function httpEventNormalizer(): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult>;
  export default httpEventNormalizer;
}

declare module '@middy/http-header-normalizer' {
  import { MiddlewareObj } from '@middy/core';
  import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

  function httpHeaderNormalizer(): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult>;
  export default httpHeaderNormalizer;
}
