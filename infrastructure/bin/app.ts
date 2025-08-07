#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
import { StackOrchestrator } from '../lib/stack-orchestrator';

const app = new cdk.App();
const orchestrator = new StackOrchestrator(app);

orchestrator.deployStacks();
