import re

with open('tests/e2e/dashboard-live.spec.js', 'r') as f:
    content = f.read()

# Pattern to match:
# await page.route( ... async (route) => {
#    ...
# });
# We use a non-greedy match that stops at the first });
# However, there might be nested curly braces.
# Actually, replacing all `await page.route` blocks might be risky if we just use simple regex.
# Let's just do a simple replacement for the exact mock blocks we know.
# A simpler way: we just read line by line. If we see `await page.route`, we skip lines until we see `    });` or `  });`.

lines = content.split('\n')
out_lines = []
skip = False
for line in lines:
    if 'await page.route(' in line:
        skip = True
        continue
    if skip and line.strip() == '});':
        skip = False
        continue
    if not skip:
        out_lines.append(line)

with open('tests/e2e/dashboard-live.spec.js', 'w') as f:
    f.write('\n'.join(out_lines))
