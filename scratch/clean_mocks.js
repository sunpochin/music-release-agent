const fs = require('fs');
let content = fs.readFileSync('tests/e2e/dashboard-live.spec.js', 'utf8');
// Remove all page.route blocks. They look like: await page.route('...', async (route) => { ... });
// We can use a regex that matches await page.route(.*?); where it spans multiple lines.
// Since it's nested, regex might be tricky, but we know they all end with \n    });
content = content.replace(/await page\.route\([\s\S]*?\n\s{4}\}\);\n/g, '');
fs.writeFileSync('tests/e2e/dashboard-live.spec.js', content);
