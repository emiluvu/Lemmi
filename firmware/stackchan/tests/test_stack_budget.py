import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('stack_check',Path(__file__).parents[1]/'tools/check-stack.py')
stack=importlib.util.module_from_spec(spec)
spec.loader.exec_module(stack)

def listing(loop,tick,cancel):
    return (f'42000000 <loop()>:\n42000000: 000000 entry a1, {loop}\n'
            f'42001000 <VoiceBridge::tick(ControlPolicy const&, unsigned long, bool, bool, unsigned long)>:\n42001000: 000000 entry a1, {tick}\n'
            f'42002000 <VoiceBridge::cancelAll()>:\n42002000: 000000 entry a1, {cancel}\n')

class StackBudgetChecks(unittest.TestCase):
    def test_original_native_frames_are_rejected(self):
        with self.assertRaises(ValueError):stack.check(listing('0x2f0','0x10a0','0xdd0'))

    def test_reduced_frames_leave_callee_reserve(self):
        self.assertEqual(stack.check(listing('0x2f0','0x300','32')),1552)

    def test_missing_symbol_or_missing_reserve_fails_closed(self):
        with self.assertRaises(ValueError):stack.check('')
        with self.assertRaises(ValueError):stack.check(listing(1000,4000,1200))

if __name__=='__main__':unittest.main()
