import { CfnResource, IAspect, Tags } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

export interface TaggingConfig {
  environment: string;
  project: string;
  owner: string;
}

export class TaggingAspect implements IAspect {
  constructor(private readonly config: TaggingConfig) {}

  visit(node: IConstruct): void {
    // Apply to all CDK constructs
    if (node instanceof CfnResource) {
      Tags.of(node).add('Environment', this.config.environment);
      Tags.of(node).add('Project', this.config.project);
      Tags.of(node).add('Owner', this.config.owner);
    }
  }
}
