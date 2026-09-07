export type TutorialAction =
  | 'click'
  | 'input'
  | 'select'
  | 'navigate'
  | 'observe'
  | 'submit';

export interface TutorialTarget {
  selector?: string;
  text?: string;
  role?: string;
  testId?: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  body?: string;
  action: TutorialAction;
  target: TutorialTarget;
  screenshot?: string;
  expected?: string;
}

export interface Tutorial {
  id: string;
  title: string;
  description?: string;
  app: string;
  route: string;
  version: string;
  updatedAt?: string;
  steps: TutorialStep[];
}

export interface CapturedEvent {
  timestamp: string;
  action: TutorialAction;
  url: string;
  target: TutorialTarget;
  value?: string;
  screenshot?: string;
}
