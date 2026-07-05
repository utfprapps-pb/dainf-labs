import subprocess
import random

def run(cmd):
    return subprocess.check_output(cmd, shell=True).decode('utf-8')

# Get user IDs
out = run('docker exec dainf-lab-postgres psql -U postgres -d dainf_lab -t -c "SELECT id FROM app_user;"')
ids = [line.strip() for line in out.splitlines() if line.strip()]

for user_id in ids:
    new_doc = '2' + ''.join(random.choices('0123456789', k=6))
    run(f'docker exec dainf-lab-postgres psql -U postgres -d dainf_lab -c "UPDATE app_user SET documento = \'{new_doc}\' WHERE id = {user_id};"')
    print(f"User {user_id} updated to {new_doc}")
