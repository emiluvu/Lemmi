#!/usr/bin/env python3
"""Verify existing paired builds and budget one media socket; never open USB/network."""
import argparse
import importlib.util
import json
from pathlib import Path
import re

import build_pair as build

CONNECTED_HEAP_REFERENCE = 75988  # historical sample, not a measured future minimum
BOUNDED_HEAP_REFERENCE = 73156  # lower observed connected-idle 0.11 sample
RUNTIME_RESERVE = 32768  # engineering allowance, must be checked on hardware


def budget(values, reference=CONNECTED_HEAP_REFERENCE):
    required = {'TCP_MSS': 1436, 'sizeof_pbuf': 16, 'sizeof_tcp_seg': 16,
                'MEM_ALIGNMENT': 4, 'PBUF_TRANSPORT': 74, 'MEMP_OVERHEAD': 0,
                'LWIP_NETIF_TX_SINGLE_PBUF': 1, 'MEMP_MEM_MALLOC': 1,
                'MEM_LIBC_MALLOC': 1}
    if any(values.get(k) != v for k, v in required.items()):
        raise ValueError('Allocation assumptions differ from reviewed Xtensa SDK')
    align = lambda n: (n + 3) // 4 * 4
    # Source: pbuf_alloc(PBUF_RAM), tcp_pbuf_prealloc(single-pbuf), light
    # poisoning (8-byte head + 4-byte tail), TLSF 4-byte used header.
    # Each allocation also reserves a full 16-byte unsplittable TLSF tail.
    pbuf_request = align(values['sizeof_pbuf']) + align(values['PBUF_TRANSPORT']) + align(values['TCP_MSS'])
    allocation = lambda n: align(n + 12) + 4 + 16
    per_segment = allocation(pbuf_request) + allocation(values['sizeof_tcp_seg'])
    queued = values['TCP_SND_QUEUELEN'] * per_segment
    transient = 2 * per_segment  # provisional/failed allocation and control/split allowance
    margin = reference - queued - transient - RUNTIME_RESERVE
    return {'referenceConnectedFreeBytes': reference, 'pbufRequestBytes': pbuf_request,
            'pbufAllocationBoundBytes': allocation(pbuf_request),
            'segmentRecordAllocationBoundBytes': allocation(values['sizeof_tcp_seg']),
            'perSegmentBoundBytes': per_segment, 'queueSlots': values['TCP_SND_QUEUELEN'],
            'fullQueueBoundBytes': queued, 'transientAllowanceBytes': transient,
            'runtimeReserveBytes': RUNTIME_RESERVE, 'marginBytes': margin,
            'localPreparationGate': 'pass-for-bounded-test-only' if margin >= 0 else 'hold-do-not-flash'}


def check_hash(path, expected):
    if build.digest(path) != expected:
        raise ValueError('Artifact/source checksum mismatch: ' + str(path))


def validate_tcp_values(values, snd, label, policy, require_sanity=False):
    qlen = (4 * snd + 1435) // 1436
    expected = {'TCP_MSS': 1436, 'TCP_SND_BUF': snd, 'TCP_SNDLOWAT': max(snd // 2, 2873),
                'TCP_SND_QUEUELEN': qlen, 'TCP_SNDQUEUELOWAT': max(qlen // 2, 5)}
    if policy == 'bounded-16k' and label == 'candidate':
        expected.update(TCP_SNDLOWAT=2873, TCP_SND_QUEUELEN=23, TCP_SNDQUEUELOWAT=11)
    if any(values.get(k) != v for k, v in expected.items()):
        raise ValueError('Unexpected derived/reviewed TCP policy values')
    if (require_sanity or policy == 'bounded-16k') and values.get('LWIP_DISABLE_TCP_SANITY_CHECKS') != 0:
        raise ValueError('TCP sanity checks must remain enabled')
    if values['TCP_SND_QUEUELEN'] < (2 * snd + 1435) // 1436:
        raise ValueError('TCP queue cap is below the documented minimum')
    return expected


def verify(folder):
    folder = folder.resolve()
    result = json.loads((folder / 'paired-build.json').read_text())
    if result['idfCommit'] != build.EXPECTED_IDF or result['lwipCommit'] != build.EXPECTED_LWIP:
        raise ValueError('Unexpected source revisions')
    check_hash(build.tool('gcc'), result['compilerSha256'])
    if 'firmwareSources' in result and result['firmwareSources'] != build.firmware_sources():
        raise ValueError('Firmware/library inputs changed since build')
    for relative, digest in result['sources'].items():
        check_hash(build.IDF / relative, digest)
    variants = result['variants']
    if set(variants) != {'baseline', 'candidate'}:
        raise ValueError('Incomplete paired build')
    capacity = variants['candidate']['resolved']['TCP_SND_BUF']
    if capacity not in (8192, 16384):
        raise ValueError('Unreviewed candidate capacity')
    policy = result.get('policy', 'derived')
    if policy not in ('derived', 'bounded-16k') or (policy == 'bounded-16k' and capacity != 16384):
        raise ValueError('Unexpected TCP policy/capacity')
    old = (folder / 'baseline/sdk/qio_qspi/include/sdkconfig.h').read_text()
    new = (folder / 'candidate/sdk/qio_qspi/include/sdkconfig.h').read_text()
    expected_config = old.replace('CONFIG_LWIP_TCP_SND_BUF_DEFAULT 5744',
                                  'CONFIG_LWIP_TCP_SND_BUF_DEFAULT ' + str(capacity))
    if policy == 'bounded-16k':
        expected_config += build.BOUNDED_CONFIG
    if new != expected_config:
        raise ValueError('Unexpected configuration difference')
    installed = json.loads((Path(__file__).parent / 'baseline.json').read_text())['installedSdk']
    check_hash(folder / 'baseline/sdk/qio_qspi/include/sdkconfig.h', installed['variantConfigSha256'])
    check_hash(build.SDK / 'lib/liblwip.a', installed['lwipArchiveSha256'])
    check_hash(build.SDK / 'versions.txt', installed['versionsSha256'])
    spec = importlib.util.spec_from_file_location('stack_checks', build.ROOT / 'tools/check-stack.py')
    stack = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(stack)
    report = {'status': 'local-preparation-only-not-flashed', 'candidateCapacity': capacity, 'policy': policy,
              'sourceInputsVerified': 'firmwareSources' in result, 'variants': {}}
    databases = []
    sketch_databases = []
    for label, variant in variants.items():
        base = folder / label
        voice = base / 'voice'
        options = json.loads((voice / 'build.options.json').read_text())
        lock = json.loads((build.ROOT / 'toolchain.json').read_text())
        if options['fqbn'] != lock['fqbn'] or 'compiler.sdk.path=' + str(base / 'sdk') not in options['customBuildProperties']:
            raise ValueError('Wrong sketch board or SDK selection')
        for name, version in lock['libraries'].items():
            properties = (build.ROOT / '.arduino/user/libraries' / name / 'library.properties').read_text()
            if not re.search(r'^version=' + re.escape(version) + r'$', properties, re.M):
                raise ValueError('Wrong pinned library version: ' + name)
        lwip = base / 'sdk/lib/liblwip.a'
        if variant['linkedLwipArchive'] != str(lwip):
            raise ValueError('Unexpected intended archive')
        check_hash(lwip, variant['lwipArchiveSha256'])
        for suffix, key in [('bin', 'applicationSha256'), ('elf', 'elfSha256'), ('map', 'mapSha256')]:
            check_hash(voice / ('lemmi_voice_diag.ino.' + suffix), variant[key])
        link_map = (voice / 'lemmi_voice_diag.ino.map').read_text()
        if set(re.findall(r'(\S*liblwip\.a)\(', link_map)) != {str(lwip)}:
            raise ValueError('Wrong or mixed linked lwIP archives')
        stack.check_probe_link(link_map, tcp=result.get('tcpProbe', False))
        disassembly = build.capture([build.tool('objdump'), '-dC', voice / 'lemmi_voice_diag.ino.elf'])
        path = stack.check(disassembly)
        values = variant['resolved']
        for filename in ('resolved.json', 'resolved-app.json'):
            if json.loads((base / filename).read_text()) != values:
                raise ValueError('Application/library macro or ABI mismatch')
        snd = 5744 if label == 'baseline' else capacity
        expected = validate_tcp_values(values, snd, label, policy, require_sanity=result.get('tcpProbe', False))
        for name, digest in result['sharedSdkLibraries'].items():
            check_hash(base / 'sdk/lib' / name, digest)
        database = json.loads((base / 'compile_commands.json').read_text())
        databases.append([build.normalize_arguments(row['arguments'], base) for row in database])
        sketch_database = json.loads((voice / 'compile_commands.json').read_text())
        sketch_databases.append([build.normalize_arguments(row['arguments'], base) for row in sketch_database])
        reference = BOUNDED_HEAP_REFERENCE if policy == 'bounded-16k' else CONNECTED_HEAP_REFERENCE
        report['variants'][label] = {'macros': expected, 'ram': budget(values, reference=reference),
                                     'audioStackPathBytes': path,
                                     'applicationSha256': variant['applicationSha256']}
    if len(databases[0]) != 93 or databases[0] != databases[1]:
        raise ValueError('Compiler input count or normalized commands differ')
    # Arduino emits these entries in parallel completion order.
    if sorted(sketch_databases[0]) != sorted(sketch_databases[1]):
        raise ValueError('Sketch/library normalized compiler inputs differ')
    for name in ('sizeof_pbuf', 'sizeof_tcp_seg', 'sizeof_netconn', 'sizeof_tcp_pcb'):
        if variants['baseline']['resolved'][name] != variants['candidate']['resolved'][name]:
            raise ValueError('Paired ABI changed')
    report['verifiedCompileUnits'] = 93
    return report


def image_paths(folder):
    voice = folder.resolve() / 'candidate/voice'
    return [('0x0', voice / 'lemmi_voice_diag.ino.bootloader.bin'),
            ('0x8000', voice / 'lemmi_voice_diag.ino.partitions.bin'),
            ('0xe000', build.ROOT / '.arduino/data/packages/m5stack/hardware/esp32/3.3.10/tools/partitions/boot_app0.bin'),
            ('0x10000', voice / 'lemmi_voice_diag.ino.bin')]


def firmware_sources():
    return build.firmware_sources()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate-capacity', type=int, choices=(8192, 16384), default=8192)
    parser.add_argument('--policy', choices=('derived', 'bounded-16k'), default='derived')
    args = parser.parse_args()
    folder = build.ROOT / ('build/tcp-send-capacity-bounded-16k' if args.policy == 'bounded-16k' else
                           'build/tcp-send-capacity-8192' if args.candidate_capacity == 8192 else 'build/tcp-send-capacity')
    report = verify(folder)
    if (args.candidate_capacity == 8192 or args.policy == 'bounded-16k') and 'firmwareSources' not in json.loads((folder / 'paired-build.json').read_text()):
        raise ValueError('Rebuild the selected pair with source fingerprints before preparing it')
    report['images'] = {address: {'file': str(path), 'sha256': build.digest(path), 'bytes': path.stat().st_size}
                        for address, path in image_paths(folder)}
    report['firmwareSources'] = firmware_sources()
    (folder / 'assessment.json').write_text(json.dumps(report, indent=2) + '\n')
    for label, variant in report['variants'].items():
        ram = variant['ram']
        print(f"{label}: send={variant['macros']['TCP_SND_BUF']} "
              f"margin={ram['marginBytes']} gate={ram['localPreparationGate']} "
              f"sha256={variant['applicationSha256']}")
    print('PASS: paired hashes, compiler inputs, ABI, library selection and hook/stack checks; assessment.json saved. No USB/network operation.')


if __name__ == '__main__':
    main()
