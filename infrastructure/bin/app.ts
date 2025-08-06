#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
import { MainStack } from '../lib/main-stack';
import { EnvironmentConfigFactory } from '../lib/config/environment-config';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';

// Create environment-specific configuration
const config = EnvironmentConfigFactory.create(environment);
const projectName = 'serverless-blueprint';

// Validate required parameters
if (!config.account) {
  throw new Error(
    'Account must be specified either via context or CDK_DEFAULT_ACCOUNT environment variable'
  );
}

// Create single main stack that orchestrates all nested stacks
const mainStack = new MainStack(app, `${projectName}-${environment}`, {
  env: {
    account: config.account,
    region: config.region,
  },
  environment,
  config,
  projectName,
  description: `${projectName} infrastructure - ${environment} environment`,
});
