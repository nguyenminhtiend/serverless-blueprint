#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const database_stack_1 = require("../lib/database-stack");
const lambda_stack_1 = require("../lib/lambda-stack");
const api_gateway_stack_1 = require("../lib/api-gateway-stack");
const app = new cdk.App();
// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';
const account = app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT;
const region = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'ap-southeast-1';
// Validate required parameters
if (!account) {
    throw new Error('Account must be specified either via context or CDK_DEFAULT_ACCOUNT environment variable');
}
// Common stack props
const stackProps = {
    env: {
        account,
        region,
    },
    description: `Serverless Microservices - ${environment} environment`,
    tags: {
        Environment: environment,
        Project: 'ServerlessMicroservices',
        ManagedBy: 'CDK',
    },
};
// Database Stack - Phase 3
const databaseStack = new database_stack_1.DatabaseStack(app, `ServerlessMicroservices-Database-${environment}`, {
    ...stackProps,
    environment,
    description: `DynamoDB infrastructure for ${environment} environment`,
});
// Lambda Stack - Phase 4
const lambdaStack = new lambda_stack_1.LambdaStack(app, `ServerlessMicroservices-Lambda-${environment}`, {
    ...stackProps,
    environment,
    table: databaseStack.table,
    description: `Lambda functions for ${environment} environment`,
});
// API Gateway Stack - Phase 4  
const apiGatewayStack = new api_gateway_stack_1.ApiGatewayStack(app, `ServerlessMicroservices-ApiGateway-${environment}`, {
    ...stackProps,
    environment,
    authFunction: lambdaStack.authFunction,
    userFunction: lambdaStack.userFunction,
    orderFunction: lambdaStack.orderFunction,
    description: `API Gateway infrastructure for ${environment} environment`,
});
// Add stack dependencies
lambdaStack.addDependency(databaseStack);
apiGatewayStack.addDependency(lambdaStack);
// Stack naming convention is set in cdk.json context
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vYmluL2FwcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSx1Q0FBb0M7QUFDcEMsaURBQWtDO0FBQ2xDLDBEQUFxRDtBQUNyRCxzREFBaUQ7QUFDakQsZ0VBQTBEO0FBRTFELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFBO0FBRXpCLG1EQUFtRDtBQUNuRCxNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsSUFBSSxLQUFLLENBQUE7QUFDbEUsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQTtBQUNwRixNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLGdCQUFnQixDQUFBO0FBRXJHLCtCQUErQjtBQUMvQixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDYixNQUFNLElBQUksS0FBSyxDQUFDLDBGQUEwRixDQUFDLENBQUE7QUFDN0csQ0FBQztBQUVELHFCQUFxQjtBQUNyQixNQUFNLFVBQVUsR0FBbUI7SUFDakMsR0FBRyxFQUFFO1FBQ0gsT0FBTztRQUNQLE1BQU07S0FDUDtJQUNELFdBQVcsRUFBRSw4QkFBOEIsV0FBVyxjQUFjO0lBQ3BFLElBQUksRUFBRTtRQUNKLFdBQVcsRUFBRSxXQUFXO1FBQ3hCLE9BQU8sRUFBRSx5QkFBeUI7UUFDbEMsU0FBUyxFQUFFLEtBQUs7S0FDakI7Q0FDRixDQUFBO0FBRUQsMkJBQTJCO0FBQzNCLE1BQU0sYUFBYSxHQUFHLElBQUksOEJBQWEsQ0FBQyxHQUFHLEVBQUUsb0NBQW9DLFdBQVcsRUFBRSxFQUFFO0lBQzlGLEdBQUcsVUFBVTtJQUNiLFdBQVc7SUFDWCxXQUFXLEVBQUUsK0JBQStCLFdBQVcsY0FBYztDQUN0RSxDQUFDLENBQUE7QUFFRix5QkFBeUI7QUFDekIsTUFBTSxXQUFXLEdBQUcsSUFBSSwwQkFBVyxDQUFDLEdBQUcsRUFBRSxrQ0FBa0MsV0FBVyxFQUFFLEVBQUU7SUFDeEYsR0FBRyxVQUFVO0lBQ2IsV0FBVztJQUNYLEtBQUssRUFBRSxhQUFhLENBQUMsS0FBSztJQUMxQixXQUFXLEVBQUUsd0JBQXdCLFdBQVcsY0FBYztDQUMvRCxDQUFDLENBQUE7QUFFRixnQ0FBZ0M7QUFDaEMsTUFBTSxlQUFlLEdBQUcsSUFBSSxtQ0FBZSxDQUFDLEdBQUcsRUFBRSxzQ0FBc0MsV0FBVyxFQUFFLEVBQUU7SUFDcEcsR0FBRyxVQUFVO0lBQ2IsV0FBVztJQUNYLFlBQVksRUFBRSxXQUFXLENBQUMsWUFBWTtJQUN0QyxZQUFZLEVBQUUsV0FBVyxDQUFDLFlBQVk7SUFDdEMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxhQUFhO0lBQ3hDLFdBQVcsRUFBRSxrQ0FBa0MsV0FBVyxjQUFjO0NBQ3pFLENBQUMsQ0FBQTtBQUVGLHlCQUF5QjtBQUN6QixXQUFXLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFBO0FBQ3hDLGVBQWUsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUE7QUFFMUMscURBQXFEIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInXG5pbXBvcnQgeyBEYXRhYmFzZVN0YWNrIH0gZnJvbSAnLi4vbGliL2RhdGFiYXNlLXN0YWNrJ1xuaW1wb3J0IHsgTGFtYmRhU3RhY2sgfSBmcm9tICcuLi9saWIvbGFtYmRhLXN0YWNrJ1xuaW1wb3J0IHsgQXBpR2F0ZXdheVN0YWNrIH0gZnJvbSAnLi4vbGliL2FwaS1nYXRld2F5LXN0YWNrJ1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpXG5cbi8vIEdldCBlbnZpcm9ubWVudCBmcm9tIGNvbnRleHQgb3IgZGVmYXVsdCB0byAnZGV2J1xuY29uc3QgZW52aXJvbm1lbnQgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdlbnZpcm9ubWVudCcpIHx8ICdkZXYnXG5jb25zdCBhY2NvdW50ID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnYWNjb3VudCcpIHx8IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlRcbmNvbnN0IHJlZ2lvbiA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3JlZ2lvbicpIHx8IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAnYXAtc291dGhlYXN0LTEnXG5cbi8vIFZhbGlkYXRlIHJlcXVpcmVkIHBhcmFtZXRlcnNcbmlmICghYWNjb3VudCkge1xuICB0aHJvdyBuZXcgRXJyb3IoJ0FjY291bnQgbXVzdCBiZSBzcGVjaWZpZWQgZWl0aGVyIHZpYSBjb250ZXh0IG9yIENES19ERUZBVUxUX0FDQ09VTlQgZW52aXJvbm1lbnQgdmFyaWFibGUnKVxufVxuXG4vLyBDb21tb24gc3RhY2sgcHJvcHNcbmNvbnN0IHN0YWNrUHJvcHM6IGNkay5TdGFja1Byb3BzID0ge1xuICBlbnY6IHtcbiAgICBhY2NvdW50LFxuICAgIHJlZ2lvbixcbiAgfSxcbiAgZGVzY3JpcHRpb246IGBTZXJ2ZXJsZXNzIE1pY3Jvc2VydmljZXMgLSAke2Vudmlyb25tZW50fSBlbnZpcm9ubWVudGAsXG4gIHRhZ3M6IHtcbiAgICBFbnZpcm9ubWVudDogZW52aXJvbm1lbnQsXG4gICAgUHJvamVjdDogJ1NlcnZlcmxlc3NNaWNyb3NlcnZpY2VzJyxcbiAgICBNYW5hZ2VkQnk6ICdDREsnLFxuICB9LFxufVxuXG4vLyBEYXRhYmFzZSBTdGFjayAtIFBoYXNlIDNcbmNvbnN0IGRhdGFiYXNlU3RhY2sgPSBuZXcgRGF0YWJhc2VTdGFjayhhcHAsIGBTZXJ2ZXJsZXNzTWljcm9zZXJ2aWNlcy1EYXRhYmFzZS0ke2Vudmlyb25tZW50fWAsIHtcbiAgLi4uc3RhY2tQcm9wcyxcbiAgZW52aXJvbm1lbnQsXG4gIGRlc2NyaXB0aW9uOiBgRHluYW1vREIgaW5mcmFzdHJ1Y3R1cmUgZm9yICR7ZW52aXJvbm1lbnR9IGVudmlyb25tZW50YCxcbn0pXG5cbi8vIExhbWJkYSBTdGFjayAtIFBoYXNlIDRcbmNvbnN0IGxhbWJkYVN0YWNrID0gbmV3IExhbWJkYVN0YWNrKGFwcCwgYFNlcnZlcmxlc3NNaWNyb3NlcnZpY2VzLUxhbWJkYS0ke2Vudmlyb25tZW50fWAsIHtcbiAgLi4uc3RhY2tQcm9wcyxcbiAgZW52aXJvbm1lbnQsXG4gIHRhYmxlOiBkYXRhYmFzZVN0YWNrLnRhYmxlLFxuICBkZXNjcmlwdGlvbjogYExhbWJkYSBmdW5jdGlvbnMgZm9yICR7ZW52aXJvbm1lbnR9IGVudmlyb25tZW50YCxcbn0pXG5cbi8vIEFQSSBHYXRld2F5IFN0YWNrIC0gUGhhc2UgNCAgXG5jb25zdCBhcGlHYXRld2F5U3RhY2sgPSBuZXcgQXBpR2F0ZXdheVN0YWNrKGFwcCwgYFNlcnZlcmxlc3NNaWNyb3NlcnZpY2VzLUFwaUdhdGV3YXktJHtlbnZpcm9ubWVudH1gLCB7XG4gIC4uLnN0YWNrUHJvcHMsXG4gIGVudmlyb25tZW50LFxuICBhdXRoRnVuY3Rpb246IGxhbWJkYVN0YWNrLmF1dGhGdW5jdGlvbixcbiAgdXNlckZ1bmN0aW9uOiBsYW1iZGFTdGFjay51c2VyRnVuY3Rpb24sXG4gIG9yZGVyRnVuY3Rpb246IGxhbWJkYVN0YWNrLm9yZGVyRnVuY3Rpb24sXG4gIGRlc2NyaXB0aW9uOiBgQVBJIEdhdGV3YXkgaW5mcmFzdHJ1Y3R1cmUgZm9yICR7ZW52aXJvbm1lbnR9IGVudmlyb25tZW50YCxcbn0pXG5cbi8vIEFkZCBzdGFjayBkZXBlbmRlbmNpZXNcbmxhbWJkYVN0YWNrLmFkZERlcGVuZGVuY3koZGF0YWJhc2VTdGFjaylcbmFwaUdhdGV3YXlTdGFjay5hZGREZXBlbmRlbmN5KGxhbWJkYVN0YWNrKVxuXG4vLyBTdGFjayBuYW1pbmcgY29udmVudGlvbiBpcyBzZXQgaW4gY2RrLmpzb24gY29udGV4dCJdfQ==