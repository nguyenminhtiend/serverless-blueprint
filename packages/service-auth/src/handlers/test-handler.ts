import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('🚀 POST Handler with Path Parameter called');
  console.log('Full Event:', JSON.stringify(event, null, 2));

  try {
    // Extract path parameter
    const userId = event.pathParameters?.userId;

    // Parse request body
    let requestBody: any = {};
    if (event.body) {
      const bodyString = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;

      try {
        requestBody = JSON.parse(bodyString);
        console.log('📝 Body parsed:', requestBody);
      } catch (parseError) {
        console.warn('⚠️ Body parsing failed:', parseError);
        requestBody = { rawBody: bodyString };
      }
    }

    // Log all request details
    console.log('📊 Request Details:', {
      method: event.httpMethod,
      path: event.path,
      pathParameters: event.pathParameters,
      queryStringParameters: event.queryStringParameters,
      headers: {
        'content-type': event.headers['Content-Type'] || event.headers['content-type'],
        'user-agent': event.headers['User-Agent'],
        authorization: event.headers['Authorization'] ? 'Bearer ***' : undefined,
      },
      body: requestBody,
      requestId: event.requestContext.requestId,
      sourceIp: event.requestContext.identity?.sourceIp,
    });

    // Validate path parameter
    if (!userId) {
      console.error('❌ Missing userId path parameter');
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Missing userId parameter',
          message: 'userId is required in the path',
        }),
      };
    }

    // Process the request
    const response = {
      message: '✅ POST handler with path parameter successful',
      userId,
      receivedData: requestBody,
      processedAt: new Date().toISOString(),
      requestId: event.requestContext.requestId,
      stats: {
        method: event.httpMethod,
        path: event.path,
        hasBody: !!event.body,
        bodyKeys: Object.keys(requestBody).length,
      },
      success: true,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('❌ Handler error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'Something went wrong processing your request',
      }),
    };
  }
};
