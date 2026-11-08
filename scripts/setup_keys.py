"""Prompt privately and save local provider configuration without printing secrets."""
import getpass
import os
from pathlib import Path
root = Path(__file__).resolve().parent.parent
target = root / '.env'
existing = {}
if target.exists():
    for line in target.read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            existing[k] = v
for name, label in [('NVIDIA_API_KEY', 'NVIDIA Nemotron API key'), ('NESSIE_API_KEY', 'Nessie v2 API key')]:
    value = getpass.getpass(label + (' (Enter to keep existing)' if existing.get(name) else '') + ': ').strip()
    if value:
        if any(c in value for c in '\r\n\x00\'"# '):
            raise SystemExit('Unexpected characters in key; configuration was not saved.')
        existing[name] = value
    if not existing.get(name):
        raise SystemExit('Both keys are required; configuration was not saved.')
existing['NVIDIA_MODEL'] = 'nvidia/nemotron-3.5-super-vl-120b-a12b'
existing['NESSIE_BASE_URL'] = 'https://v2-prod-api.nessieisreal.com'
existing.setdefault('PORT', '3002')
fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
os.fchmod(fd, 0o600)
with os.fdopen(fd, 'w') as f:
    f.write(''.join(k + '=' + v + '\n' for k, v in existing.items()))
print('Keys saved privately in nextmove/.env. No keys were displayed.')
