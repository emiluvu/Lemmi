import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

folder = Path(__file__).parents[1] / 'experiments/tcp-send-capacity'
sys.path.insert(0, str(folder))
spec = importlib.util.spec_from_file_location('capacity_assessment', folder / 'assess_pair.py')
assessment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assessment)


class SendCapacityBudget(unittest.TestCase):
    def values(self, slots):
        return dict(TCP_MSS=1436, sizeof_pbuf=16, sizeof_tcp_seg=16,
                    MEM_ALIGNMENT=4, PBUF_TRANSPORT=74, MEMP_OVERHEAD=0,
                    LWIP_NETIF_TX_SINGLE_PBUF=1, MEMP_MEM_MALLOC=1,
                    MEM_LIBC_MALLOC=1, TCP_SND_QUEUELEN=slots)

    def test_full_queue_and_allocator_overhead_block_16k(self):
        result = assessment.budget(self.values(46))
        self.assertEqual(result['localPreparationGate'], 'hold-do-not-flash')
        self.assertLess(result['marginBytes'], 0)
        self.assertGreater(result['fullQueueBoundBytes'], 16384 * 4)

    def test_smaller_candidate_depends_on_reference_and_reserve(self):
        self.assertEqual(assessment.budget(self.values(23))['localPreparationGate'], 'pass-for-bounded-test-only')
        self.assertEqual(assessment.budget(self.values(23), reference=70000)['localPreparationGate'], 'hold-do-not-flash')
        self.assertEqual(assessment.budget(self.values(23), reference=73156)['marginBytes'], 188)
        self.assertEqual(assessment.budget(self.values(23), reference=72967)['localPreparationGate'], 'hold-do-not-flash')

    def test_changed_allocator_assumptions_fail_closed(self):
        values = self.values(23)
        values['MEM_ALIGNMENT'] = 8
        with self.assertRaises(ValueError):
            assessment.budget(values)

    def test_modified_artifact_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'artifact'
            path.write_bytes(b'original')
            digest = assessment.build.digest(path)
            path.write_bytes(b'modified')
            with self.assertRaises(ValueError):
                assessment.check_hash(path, digest)

    def test_bounded_policy_rejects_old_expensive_or_gated_candidate(self):
        values=dict(TCP_MSS=1436,TCP_SND_BUF=16384,TCP_SNDLOWAT=2873,
                    TCP_SND_QUEUELEN=23,TCP_SNDQUEUELOWAT=11,LWIP_DISABLE_TCP_SANITY_CHECKS=0)
        assessment.validate_tcp_values(values,16384,'candidate','bounded-16k')
        for field,bad in [('TCP_SND_QUEUELEN',46),('TCP_SND_QUEUELEN',16),
                          ('TCP_SNDLOWAT',8192),('LWIP_DISABLE_TCP_SANITY_CHECKS',1)]:
            changed=dict(values);changed[field]=bad
            with self.assertRaises(ValueError):
                assessment.validate_tcp_values(changed,16384,'candidate','bounded-16k')
