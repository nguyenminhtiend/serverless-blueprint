import { TaggingConfig } from '../aspects/tagging-aspect';

export class TaggingConfigFactory {
  static create(environment: string): TaggingConfig {
    return {
      environment,
      project: 'serverless-blueprint',
      owner: 'platform-team',
    };
  }
}