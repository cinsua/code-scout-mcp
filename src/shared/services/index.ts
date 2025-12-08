// Service exports
export {
  BaseService,
  type ServiceOptions,
  type OperationContext,
} from './BaseService';

export {
  ErrorAggregator,
  type ErrorAggregatorOptions,
  type AlertConfig,
  type ErrorAggregation,
  type ErrorRateData,
} from './ErrorAggregator';

export type { IErrorAggregator, ErrorAlert, ErrorPattern } from './types';
