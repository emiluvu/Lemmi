import { SessionCoordinator } from './session-coordinator';
// Explicit mock entry point retained for the development shells/tests.
export class MockCoordinator extends SessionCoordinator {
  constructor() {
    super('mock');
  }
}
