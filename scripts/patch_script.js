const fs = require('fs');

let appTsx = fs.readFileSync('src/App.tsx', 'utf-8');

// Replacements in App.tsx
appTsx = appTsx.replace(/const SERVER_URL = "http:\/\/localhost:3001";/, `const SERVER_URL = "http://localhost:3001";\nconst WS_URL = "ws://localhost:3030";`);

// We'll just replace the whole App.tsx with a rewritten version to be safe, using sed or standard tools.
