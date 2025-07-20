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
new database_stack_1.DatabaseStack(app, `ServerlessMicroservices-Database-${environment}`, {
    ...stackProps,
    environment,
    description: `DynamoDB infrastructure for ${environment} environment`,
});
// Stack naming convention is set in cdk.json context
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vYmluL2FwcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSx1Q0FBb0M7QUFDcEMsaURBQWtDO0FBQ2xDLDBEQUFxRDtBQUVyRCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQTtBQUV6QixtREFBbUQ7QUFDbkQsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLElBQUksS0FBSyxDQUFBO0FBQ2xFLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUE7QUFDcEYsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxnQkFBZ0IsQ0FBQTtBQUVyRywrQkFBK0I7QUFDL0IsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQywwRkFBMEYsQ0FBQyxDQUFBO0FBQzdHLENBQUM7QUFFRCxxQkFBcUI7QUFDckIsTUFBTSxVQUFVLEdBQW1CO0lBQ2pDLEdBQUcsRUFBRTtRQUNILE9BQU87UUFDUCxNQUFNO0tBQ1A7SUFDRCxXQUFXLEVBQUUsOEJBQThCLFdBQVcsY0FBYztJQUNwRSxJQUFJLEVBQUU7UUFDSixXQUFXLEVBQUUsV0FBVztRQUN4QixPQUFPLEVBQUUseUJBQXlCO1FBQ2xDLFNBQVMsRUFBRSxLQUFLO0tBQ2pCO0NBQ0YsQ0FBQTtBQUVELDJCQUEyQjtBQUMzQixJQUFJLDhCQUFhLENBQUMsR0FBRyxFQUFFLG9DQUFvQyxXQUFXLEVBQUUsRUFBRTtJQUN4RSxHQUFHLFVBQVU7SUFDYixXQUFXO0lBQ1gsV0FBVyxFQUFFLCtCQUErQixXQUFXLGNBQWM7Q0FDdEUsQ0FBQyxDQUFBO0FBRUYscURBQXFEIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInXG5pbXBvcnQgeyBEYXRhYmFzZVN0YWNrIH0gZnJvbSAnLi4vbGliL2RhdGFiYXNlLXN0YWNrJ1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpXG5cbi8vIEdldCBlbnZpcm9ubWVudCBmcm9tIGNvbnRleHQgb3IgZGVmYXVsdCB0byAnZGV2J1xuY29uc3QgZW52aXJvbm1lbnQgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdlbnZpcm9ubWVudCcpIHx8ICdkZXYnXG5jb25zdCBhY2NvdW50ID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnYWNjb3VudCcpIHx8IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlRcbmNvbnN0IHJlZ2lvbiA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3JlZ2lvbicpIHx8IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAnYXAtc291dGhlYXN0LTEnXG5cbi8vIFZhbGlkYXRlIHJlcXVpcmVkIHBhcmFtZXRlcnNcbmlmICghYWNjb3VudCkge1xuICB0aHJvdyBuZXcgRXJyb3IoJ0FjY291bnQgbXVzdCBiZSBzcGVjaWZpZWQgZWl0aGVyIHZpYSBjb250ZXh0IG9yIENES19ERUZBVUxUX0FDQ09VTlQgZW52aXJvbm1lbnQgdmFyaWFibGUnKVxufVxuXG4vLyBDb21tb24gc3RhY2sgcHJvcHNcbmNvbnN0IHN0YWNrUHJvcHM6IGNkay5TdGFja1Byb3BzID0ge1xuICBlbnY6IHtcbiAgICBhY2NvdW50LFxuICAgIHJlZ2lvbixcbiAgfSxcbiAgZGVzY3JpcHRpb246IGBTZXJ2ZXJsZXNzIE1pY3Jvc2VydmljZXMgLSAke2Vudmlyb25tZW50fSBlbnZpcm9ubWVudGAsXG4gIHRhZ3M6IHtcbiAgICBFbnZpcm9ubWVudDogZW52aXJvbm1lbnQsXG4gICAgUHJvamVjdDogJ1NlcnZlcmxlc3NNaWNyb3NlcnZpY2VzJyxcbiAgICBNYW5hZ2VkQnk6ICdDREsnLFxuICB9LFxufVxuXG4vLyBEYXRhYmFzZSBTdGFjayAtIFBoYXNlIDNcbm5ldyBEYXRhYmFzZVN0YWNrKGFwcCwgYFNlcnZlcmxlc3NNaWNyb3NlcnZpY2VzLURhdGFiYXNlLSR7ZW52aXJvbm1lbnR9YCwge1xuICAuLi5zdGFja1Byb3BzLFxuICBlbnZpcm9ubWVudCxcbiAgZGVzY3JpcHRpb246IGBEeW5hbW9EQiBpbmZyYXN0cnVjdHVyZSBmb3IgJHtlbnZpcm9ubWVudH0gZW52aXJvbm1lbnRgLFxufSlcblxuLy8gU3RhY2sgbmFtaW5nIGNvbnZlbnRpb24gaXMgc2V0IGluIGNkay5qc29uIGNvbnRleHQiXX0=