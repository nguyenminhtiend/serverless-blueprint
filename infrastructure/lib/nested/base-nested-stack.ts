import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Tags } from 'aws-cdk-lib';

export interface BaseNestedStackProps extends cdk.NestedStackProps {
  environment: 'dev' | 'staging' | 'prod';
  projectName: string;
  vpc?: cdk.aws_ec2.IVpc;
}

export abstract class BaseNestedStack extends cdk.NestedStack {
  public readonly environment: string;
  protected readonly projectName: string;

  constructor(scope: Construct, id: string, props: BaseNestedStackProps) {
    super(scope, id, props);

    this.environment = props.environment;
    this.projectName = props.projectName;

    // Apply consistent tagging
    Tags.of(this).add('Environment', props.environment);
    Tags.of(this).add('Project', props.projectName);
    Tags.of(this).add('ManagedBy', 'CDK');
    Tags.of(this).add('DeployedAt', new Date().toISOString());
  }
}
