#!/usr/bin/env python3
"""Compile isolated lwIP/voice pairs. No serial, provisioning, or upload code."""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import shlex
import subprocess

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'build/tcp-send-capacity'
SDK = ROOT / '.arduino/data/packages/m5stack/tools/esp32s3-libs/3.3.10'
IDF = WORK / 'esp-idf'
TOOLS = ROOT / '.arduino/data/packages/m5stack/tools/esp-x32'
EXPECTED_IDF = '735507283d5b2f9fb363a1901172dbd9e847945d'
EXPECTED_LWIP = 'fd432e4ee2cfb7f7f1c7eb7227e0173412e7b84e'
POLICY = 'derived'
BOUNDED_CONFIG = '\n// Bounded TCP byte-capacity candidate; no shared SDK modification.\n#define TCP_SND_QUEUELEN 23\n#define TCP_SNDLOWAT 2873\n#define LEMMI_TCP_BOUNDED16 1\n'
EXPECTED = {
    'baseline': {'TCP_MSS': 1436, 'TCP_SND_BUF': 5744, 'TCP_SNDLOWAT': 2873,
                 'TCP_SND_QUEUELEN': 16, 'TCP_SNDQUEUELOWAT': 8},
    'candidate': {'TCP_MSS': 1436, 'TCP_SND_BUF': 16384, 'TCP_SNDLOWAT': 8192,
                  'TCP_SND_QUEUELEN': 46, 'TCP_SNDQUEUELOWAT': 23},
}


def capture(args, **kwargs):
    return subprocess.check_output([str(a) for a in args], text=True, **kwargs)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def firmware_sources():
    return {str(path.relative_to(ROOT)): digest(path)
            for directory in ('audio', 'lemmi_control', 'lemmi_voice_diag', 'motion', 'presentation',
                              '.arduino/user/libraries/M5Unified', '.arduino/user/libraries/M5GFX')
            for path in sorted((ROOT / directory).rglob('*'))
            if path.is_file() and path.suffix in ('.h', '.hpp', '.inl', '.c', '.cpp', '.ino', '.properties')}


def verify_resolved(label, values):
    if any(values.get(k) != v for k, v in EXPECTED[label].items()):
        raise ValueError('Unexpected resolved capacity/writable thresholds: ' + label)


def normalize_arguments(arguments, prefix):
    return [arg.replace(str(prefix), '{variant}') for arg in arguments]


def tool(name):
    found = list(TOOLS.glob('*/bin/xtensa-esp32s3-elf-' + name))
    if len(found) != 1:
        raise ValueError('Expected one pinned compiler/tool: ' + name)
    return found[0]


def make_overlay(label, capacity):
    out = WORK / label / 'sdk'
    out.mkdir(parents=True, exist_ok=True)
    for entry in SDK.iterdir():
        if entry.name not in ('lib', 'qio_qspi'):
            dest = out / entry.name
            if not dest.exists():
                dest.symlink_to(entry, target_is_directory=entry.is_dir())
    for directory in ('lib', 'qio_qspi', 'qio_qspi/include'):
        dest = out / directory
        if dest.is_symlink():
            raise ValueError('Refusing to write through a shared SDK directory')
        dest.mkdir(exist_ok=True)
        for entry in (SDK / directory).iterdir():
            if (directory == 'lib' and entry.name == 'liblwip.a') or (
                directory == 'qio_qspi' and entry.name == 'include'
            ) or (directory == 'qio_qspi/include' and entry.name == 'sdkconfig.h'):
                continue
            link = dest / entry.name
            if not link.exists():
                link.symlink_to(entry, target_is_directory=entry.is_dir())
    original = (SDK / 'qio_qspi/include/sdkconfig.h').read_text()
    needle = '#define CONFIG_LWIP_TCP_SND_BUF_DEFAULT 5744'
    if original.count(needle) != 1:
        raise ValueError('Unexpected baseline SDK configuration')
    config = original.replace(needle, '#define CONFIG_LWIP_TCP_SND_BUF_DEFAULT ' + str(capacity))
    if POLICY == 'bounded-16k' and label == 'candidate':
        config += BOUNDED_CONFIG
    (out / 'qio_qspi/include/sdkconfig.h').write_text(config)
    return out


def compiler_args(sdk):
    flags = shlex.split((SDK / 'flags/c_flags').read_text())
    defines = shlex.split((SDK / 'flags/defines').read_text())
    includes = shlex.split((SDK / 'flags/includes').read_text())
    return [str(tool('gcc')), *flags, '-Os',
            '-DESP_LWIP_COMPONENT_BUILD', '-Wno-address',
            '-Wno-type-limits', '-Wno-array-parameter', *defines,
            '-I' + str(sdk / 'qio_qspi/include'),
            '-iprefix', str(sdk / 'include') + '/', *includes]


def compile_units():
    text = capture([tool('readelf'), '--debug-dump=info', SDK / 'lib/liblwip.a'])
    units = re.findall(r'DW_TAG_compile_unit\)(.*?)(?=\n <1>|\Z)', text, re.S)
    result = []
    for unit in units:
        match = re.search(r'DW_AT_name\s*:\s*\(indirect string, offset: [^)]+\): ([^\n]*)', unit)
        if not match or '/esp-idf/components/lwip/' not in match[1]:
            raise ValueError('Unexpected shipped compile-unit source')
        source = IDF / 'components/lwip' / match[1].split('/esp-idf/components/lwip/', 1)[1]
        if not source.is_file():
            raise ValueError('Missing pinned source: ' + str(source))
        result.append(source)
    members = capture([tool('ar'), 't', SDK / 'lib/liblwip.a']).splitlines()
    if len(result) != len(members) or [p.name + '.obj' for p in result] != members:
        raise ValueError('Source/member order or coverage mismatch')
    return result


def build_archive(label, sdk, sources):
    folder = WORK / label / 'objects'
    folder.mkdir(exist_ok=True)
    jobs = []
    for i, source in enumerate(sources):
        out = folder / str(i) / (source.name + '.obj')
        out.parent.mkdir(exist_ok=True)
        jobs.append(([*compiler_args(sdk), '-c', str(source), '-o', str(out)], out))

    def compile_one(job):
        command, out = job
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        out.with_suffix('.log').write_text(result.stdout)
        if result.returncode:
            raise RuntimeError('Compile failed: ' + str(out.with_suffix('.log')))

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(compile_one, jobs))
    archive = sdk / 'lib/liblwip.a'
    archive.unlink(missing_ok=True)
    # q preserves the two different sntp.c.obj members; r would replace one.
    subprocess.run([str(tool('ar')), 'qcD', str(archive), *[str(p) for _, p in jobs]], check=True)
    subprocess.run([str(tool('ar')), 'sD', str(archive)], check=True)
    expected = capture([tool('ar'), 't', SDK / 'lib/liblwip.a'])
    if capture([tool('ar'), 't', archive]) != expected:
        raise ValueError('Rebuilt archive member mismatch')
    (WORK / label / 'compile_commands.json').write_text(json.dumps(
        [{'arguments': cmd, 'file': str(src), 'output': str(out)}
         for (cmd, out), src in zip(jobs, sources)], indent=2) + '\n')
    return archive


def probe(sdk, label):
    expressions = {
        'TCP_MSS': 'TCP_MSS', 'TCP_SND_BUF': 'TCP_SND_BUF',
        'TCP_SNDLOWAT': 'TCP_SNDLOWAT', 'TCP_SND_QUEUELEN': 'TCP_SND_QUEUELEN',
        'TCP_SNDQUEUELOWAT': 'TCP_SNDQUEUELOWAT', 'TCP_OVERSIZE': 'TCP_OVERSIZE',
        'LWIP_NETIF_TX_SINGLE_PBUF': 'LWIP_NETIF_TX_SINGLE_PBUF',
        'MEM_ALIGNMENT': 'MEM_ALIGNMENT', 'MEM_LIBC_MALLOC': 'MEM_LIBC_MALLOC',
        'MEMP_MEM_MALLOC': 'MEMP_MEM_MALLOC', 'PBUF_TRANSPORT': 'PBUF_TRANSPORT',
        'sizeof_pbuf': 'sizeof(struct pbuf)', 'sizeof_tcp_seg': 'sizeof(struct tcp_seg)',
        'sizeof_tcp_pcb': 'sizeof(struct tcp_pcb)', 'sizeof_netconn': 'sizeof(struct netconn)',
        'MEMP_OVERHEAD': 'MEMP_SIZE',
        'LWIP_DISABLE_TCP_SANITY_CHECKS': 'LWIP_DISABLE_TCP_SANITY_CHECKS',
    }
    text = '#include "lwip/priv/tcp_priv.h"\n#include "lwip/api.h"\n#include "lwip/priv/memp_priv.h"\n'
    # init.c supplies this default locally; expose the same effective value.
    text += '#ifndef LWIP_DISABLE_TCP_SANITY_CHECKS\n#define LWIP_DISABLE_TCP_SANITY_CHECKS 0\n#endif\n'
    text += '#ifdef __cplusplus\nextern "C" {\n#define EXT extern\n#else\n#define EXT\n#endif\n'
    for name, expr in expressions.items():
        text += 'EXT const unsigned char lemmi_probe_' + name + '[(' + expr + ')+1]={0};\n'
    text += '#ifdef __cplusplus\n}\n#endif\n'
    folder = WORK / label
    source = folder / 'memory_probe.c'
    source.write_text(text)
    obj = folder / 'memory_probe.o'
    subprocess.run([*compiler_args(sdk), '-c', str(source), '-o', str(obj)], check=True)
    symbols = capture([tool('nm'), '-S', '--size-sort', obj])
    values = {}
    for size, name in re.findall(r'^\w+\s+(\w+)\s+\w\s+lemmi_probe_(\w+)$', symbols, re.M):
        values[name] = int(size, 16) - 1
    if set(values) != set(expressions):
        raise ValueError('Missing preprocessed size/macro probe')
    verify_resolved(label, values)
    (folder / 'resolved.json').write_text(json.dumps(values, indent=2) + '\n')
    return values


def build_sketch(label, sdk):
    folder = WORK / label / 'voice'
    lock = json.loads((ROOT / 'toolchain.json').read_text())
    command = [ROOT / '.tools/arduino-cli', 'compile', '--fqbn', lock['fqbn'],
               '--config-file', ROOT / '.tools/arduino-cli.yaml', '--build-path', folder,
               '--build-property', 'compiler.sdk.path=' + str(sdk),
               '--build-property', 'compiler.c.elf.extra_flags=-Wl,--cref -Wl,--wrap=esp_transport_poll_write -Wl,--wrap=esp_tls_conn_write -Wl,--wrap=netconn_write_partly',
               ROOT / 'lemmi_voice_diag']
    with (WORK / label / 'sketch-build.log').open('w') as log:
        subprocess.run([str(a) for a in command], stdout=log, stderr=subprocess.STDOUT, check=True)
    elf = folder / 'lemmi_voice_diag.ino.elf'
    map_path = folder / 'lemmi_voice_diag.ino.map'
    subprocess.run(['python3', str(ROOT / 'tools/check-stack.py'), '--elf', str(elf),
                    '--objdump', str(tool('objdump')), '--transport-probe-map', str(map_path), '--tcp-probe'], check=True)
    text = map_path.read_text()
    intended = str(sdk / 'lib/liblwip.a')
    used = set(re.findall(r'(\S*liblwip\.a)\(', text))
    if used != {intended}:
        raise ValueError('Wrong or mixed linked lwIP archive: ' + repr(used))
    database = json.loads((folder / 'compile_commands.json').read_text())
    entry = next(row for row in database if row['file'].endswith('lemmi_voice_diag.ino.cpp'))
    args = entry['arguments'][:]
    args[args.index(entry['file'])] = str(WORK / label / 'memory_probe.c')
    app_obj = WORK / label / 'memory_probe_app.o'
    args[args.index('-o') + 1] = str(app_obj)
    subprocess.run(args, cwd=entry['directory'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    symbols = capture([tool('nm'), '-S', '--size-sort', app_obj])
    app_values = {name: int(size, 16) - 1 for size, name in re.findall(
        r'^\w+\s+(\w+)\s+\w\s+lemmi_probe_(\w+)$', symbols, re.M)}
    library_values = json.loads((WORK / label / 'resolved.json').read_text())
    if app_values != library_values:
        raise ValueError('Sketch and rebuilt library header configuration/ABI differ')
    (WORK / label / 'resolved-app.json').write_text(json.dumps(app_values, indent=2) + '\n')
    return {'applicationSha256': digest(folder / 'lemmi_voice_diag.ino.bin'),
            'elfSha256': digest(elf), 'mapSha256': digest(map_path), 'linkedLwipArchive': intended}


def main():
    global WORK, POLICY
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate-capacity', type=int, choices=(8192, 16384), default=16384)
    parser.add_argument('--policy', choices=('derived', 'bounded-16k'), default='derived')
    args = parser.parse_args()
    POLICY = args.policy
    if POLICY == 'bounded-16k':
        if args.candidate_capacity != 16384:
            raise ValueError('The bounded policy requires 16384 byte capacity')
        WORK = ROOT / 'build/tcp-send-capacity-bounded-16k'
        EXPECTED['candidate'] = {'TCP_MSS': 1436, 'TCP_SND_BUF': 16384,
                                 'TCP_SNDLOWAT': 2873, 'TCP_SND_QUEUELEN': 23,
                                 'TCP_SNDQUEUELOWAT': 11}
    elif args.candidate_capacity == 8192:
        WORK = ROOT / 'build/tcp-send-capacity-8192'
        EXPECTED['candidate'] = {'TCP_MSS': 1436, 'TCP_SND_BUF': 8192,
                                 'TCP_SNDLOWAT': 4096, 'TCP_SND_QUEUELEN': 23,
                                 'TCP_SNDQUEUELOWAT': 11}
    WORK.mkdir(parents=True, exist_ok=True)
    if capture(['git', '-C', IDF, 'rev-parse', 'HEAD']).strip() != EXPECTED_IDF:
        raise ValueError('Wrong pinned IDF source revision')
    if capture(['git', '-C', IDF / 'components/lwip/lwip', 'rev-parse', 'HEAD']).strip() != EXPECTED_LWIP:
        raise ValueError('Wrong pinned lwIP source revision')
    baseline = json.loads((Path(__file__).parent / 'baseline.json').read_text())['installedSdk']
    for relative, key in [('versions.txt', 'versionsSha256'), ('qio_qspi/include/sdkconfig.h', 'variantConfigSha256'), ('lib/liblwip.a', 'lwipArchiveSha256')]:
        if digest(SDK / relative) != baseline[key]:
            raise ValueError('Installed SDK baseline changed: ' + relative)
    sources = compile_units()
    for header in (SDK / 'include/lwip').rglob('*'):
        if header.is_file():
            source = IDF / 'components/lwip' / header.relative_to(SDK / 'include/lwip')
            if not source.is_file() or digest(source) != digest(header):
                raise ValueError('Pinned/shipped lwIP header mismatch: ' + str(header))
    results = {'idfCommit': EXPECTED_IDF, 'lwipCommit': EXPECTED_LWIP,
               'policy': POLICY, 'tcpProbe': True,
               'method': 'paired full lwIP component rebuild; other SDK libraries unchanged',
               'compiler': capture([tool('gcc'), '--version']).splitlines()[0],
               'compilerSha256': digest(tool('gcc')),
               'firmwareSources': firmware_sources(),
               'sharedSdkLibraries': {p.name: digest(p) for p in sorted((SDK / 'lib').glob('*.a')) if p.name != 'liblwip.a'},
               'sources': {str(p.relative_to(IDF)): digest(p) for p in sources}, 'variants': {}}
    for label, capacity in [('baseline', 5744), ('candidate', args.candidate_capacity)]:
        print('Building isolated ' + label + ' (' + str(capacity) + ')', flush=True)
        sdk = make_overlay(label, capacity)
        archive = build_archive(label, sdk, sources)
        resolved = probe(sdk, label)
        results['variants'][label] = {'lwipArchiveSha256': digest(archive), 'resolved': resolved,
                                     **build_sketch(label, sdk)}
        print(label + ' archive/sketch/link checks passed', flush=True)
        if firmware_sources() != results['firmwareSources']:
            raise ValueError('Firmware/library inputs changed during build')
        (WORK / 'paired-build.json').write_text(json.dumps(results, indent=2) + '\n')
    old = (WORK / 'baseline/sdk/qio_qspi/include/sdkconfig.h').read_text()
    new = (WORK / 'candidate/sdk/qio_qspi/include/sdkconfig.h').read_text()
    expected_config = old.replace('CONFIG_LWIP_TCP_SND_BUF_DEFAULT 5744',
                                  'CONFIG_LWIP_TCP_SND_BUF_DEFAULT ' + str(args.candidate_capacity))
    if POLICY == 'bounded-16k':
        expected_config += BOUNDED_CONFIG
    if new != expected_config:
        raise ValueError('Unexpected paired configuration difference')
    left = json.loads((WORK / 'baseline/compile_commands.json').read_text())
    right = json.loads((WORK / 'candidate/compile_commands.json').read_text())
    if len(left) != len(right) or len(left) != len(sources):
        raise ValueError('Paired compiler input count mismatch')
    for a, b in zip(left, right):
        if normalize_arguments(a['arguments'], WORK / 'baseline') != normalize_arguments(b['arguments'], WORK / 'candidate'):
            raise ValueError('Unexpected paired compiler input difference')
    for name in ('sizeof_pbuf', 'sizeof_tcp_seg', 'sizeof_netconn', 'sizeof_tcp_pcb'):
        if results['variants']['baseline']['resolved'][name] != results['variants']['candidate']['resolved'][name]:
            raise ValueError('Unexpected shared ABI layout change: ' + name)
    for label in ('baseline', 'candidate'):
        for name, value in results['sharedSdkLibraries'].items():
            if digest(WORK / label / 'sdk/lib' / name) != value:
                raise ValueError('Unexpected non-lwIP library change: ' + name)
    print('PASS: isolated paired component/sketch builds; no USB or hardware operation', flush=True)


if __name__ == '__main__':
    main()
