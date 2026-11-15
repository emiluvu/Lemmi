#!/usr/bin/env python3
"""Check known nested audio stack frames in the actual Xtensa firmware ELF."""
import argparse
from pathlib import Path
import re
import subprocess

LOOP_STACK = 8192  # pinned core's unchanged Arduino loop stack
RESERVE = 2048  # allowance for other callees; not whole-program stack proof


def check(disassembly):
    frames = {}
    for name, size in re.findall(
        r"^[0-9a-f]+ <([^\n]+)>:\n[^\n]*\bentry\s+a1,\s*(0x[0-9a-f]+|\d+)",
        disassembly, re.MULTILINE,
    ):
        frames[name] = int(size, 0)
    names = ['loop()',
             'VoiceBridge::tick(ControlPolicy const&, unsigned long, bool, bool, unsigned long)',
             'VoiceBridge::cancelAll()']
    if any(name not in frames for name in names):
        raise ValueError('Expected Xtensa audio frame missing; inspect toolchain/inlining before upload')
    path = sum(frames[name] for name in names)
    if path + RESERVE > LOOP_STACK:
        raise ValueError(f'Audio call path {path} + reserve {RESERVE} exceeds loop stack {LOOP_STACK}')
    return path


def check_probe_link(link_map, tcp=False):
    lines = link_map.splitlines()
    edges = {'__wrap_esp_transport_poll_write': 'libtcp_transport.a(transport_ssl.c.obj)',
             '__wrap_esp_tls_conn_write': 'libtcp_transport.a(transport_ssl.c.obj)'}
    if tcp:
        edges['__wrap_netconn_write_partly'] = 'liblwip.a(sockets.c.obj)'
    for symbol, caller in edges.items():
        entries = [i for i, line in enumerate(lines) if line.startswith(symbol + ' ')]
        if len(entries) != 1:
            raise ValueError('Missing diagnostic wrapper cross-reference: ' + symbol)
        block = []
        for line in lines[entries[0] + 1:]:
            if line and not line.startswith(' '):
                break
            block.append(line)
        if caller not in '\n'.join(block):
            raise ValueError('SDK SSL writer does not reference diagnostic wrapper: ' + symbol)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--elf', required=True, type=Path)
    parser.add_argument('--objdump', required=True, type=Path)
    parser.add_argument('--transport-probe-map', type=Path)
    parser.add_argument('--tcp-probe', action='store_true')
    args = parser.parse_args()
    disassembly = subprocess.check_output([str(args.objdump), '-dC', str(args.elf)], text=True)
    try:
        path = check(disassembly)
        if args.transport_probe_map:
            check_probe_link(args.transport_probe_map.read_text(), tcp=args.tcp_probe)
    except ValueError as error:
        raise SystemExit(str(error)) from None
    if args.transport_probe_map:
        print('PASS: required exact SDK call sites reference diagnostic wrappers.')
    print(f'PASS: known audio path {path} + reserve {RESERVE} <= loop stack {LOOP_STACK}; runtime watermark checks still required.')


if __name__ == '__main__':
    main()
