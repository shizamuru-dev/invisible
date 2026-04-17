const fs = require('fs');
let code = fs.readFileSync('src/lib/apiClient.ts', 'utf8');

const regex = /static async presignFile.*?return result;\n    }/s;
const replacement = `static async presignFile(token: string, file_name: string, mime_type: string) {
        const query = new URLSearchParams({ file_name, mime_type }).toString();
        const result = await this.request(\`/files/presign?\${query}\`, "GET", null, token);
        return result;
    }`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/lib/apiClient.ts', code);
