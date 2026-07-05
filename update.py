import random
import re

with open('dainf-lab-server/src/main/resources/import.sql', 'r', encoding='utf-8') as f:
    content = f.read()

def repl(match):
    new_doc = '2' + ''.join(random.choices('0123456789', k=6))
    return f"VALUES('{new_doc}'"

new_content = re.sub(r"VALUES\('2343185'", repl, content)

with open('dainf-lab-server/src/main/resources/import.sql', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Updated import.sql successfully.')
