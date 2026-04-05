import type {PrivacyLevel} from './types';

export function getPrivacyLevel(leafCount: number, isFirstDeposit: boolean): PrivacyLevel {
  if (leafCount < 100) {
    return {
      level: 'low',
      message: 'Privacy pool is very small. May be traceable.',
      color: 'red',
      shouldShow: true,
    };
  }
  if (leafCount < 1000) {
    return {
      level: 'moderate',
      message: 'Privacy pool is growing. Moderate protection.',
      color: 'yellow',
      shouldShow: true,
    };
  }
  if (leafCount < 10000) {
    return {
      level: 'good',
      message: 'Good privacy protection.',
      color: 'green',
      shouldShow: true,
    };
  }
  return {
    level: 'good',
    message: 'Good privacy protection.',
    color: 'green',
    shouldShow: isFirstDeposit,
  };
}

export function shouldRepeatWarning(leafCount: number): boolean {
  return leafCount < 1000;
}
