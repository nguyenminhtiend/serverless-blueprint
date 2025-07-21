export interface BaseEvent<T = any> {
  eventType: string
  source: string
  timestamp: string
  correlationId: string
  data: T
}

export interface EventBridgeEvent<T = any> extends BaseEvent<T> {
  detail: T
  detailType: string
  source: string
  time: string
  id: string
  region: string
  version: string
  account: string
  resources: string[]
}