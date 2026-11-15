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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--elf', required=True, type=Path)
    parser.add_argument('--objdump', required=True, type=Path)
    args = parser.parse_args()
    disassembly = subprocess.check_output([str(args.objdump), '-dC', str(args.elf)], text=True)
    try:
        path = check(disassembly)
    except ValueError as error:
        raise SystemExit(str(error)) from None
    print(f'PASS: known audio path {path} + reserve {RESERVE} <= loop stack {LOOP_STACK}; runtime watermark checks still required.')


if __name__ == '__main__':
    main()
