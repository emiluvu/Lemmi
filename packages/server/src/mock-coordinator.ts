import { SessionCoordinator } from './session-coordinator';
import { teachingScriptAdapter } from './adapters/teaching-script';
// Explicit mock entry point retained for the development shells/tests.
export class MockCoordinator extends SessionCoordinator {
  constructor() {
    super('mock', teachingScriptAdapter);
  }
}
