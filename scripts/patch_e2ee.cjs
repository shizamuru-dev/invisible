const fs = require('fs');

function toUrlSafeNoPad(base64) {
    if (typeof window !== 'undefined' && window.btoa) {
        // if dealing with Uint8Array
    }
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const e2eePath = 'src/lib/e2ee.ts';
let code = fs.readFileSync(e2eePath, 'utf8');

code = code.replace(
`    return {
      key_id: signedPreKeyId,
      public_key: "mock_signed_pub",
      private_key: "mock_signed_priv",
      signature: "mock_sig"
    };`,
`    const mockPub = new Uint8Array(32);
    const mockSig = new Uint8Array(64);
    window.crypto.getRandomValues(mockPub);
    window.crypto.getRandomValues(mockSig);
    
    // Standard base64 to be converted later, or just convert here
    const pubB64 = btoa(String.fromCharCode(...mockPub));
    const sigB64 = btoa(String.fromCharCode(...mockSig));

    return {
      key_id: signedPreKeyId,
      public_key: pubB64,
      private_key: "mock_signed_priv",
      signature: sigB64
    };`);

fs.writeFileSync(e2eePath, code);

const appPath = 'src/App.tsx';
let appCode = fs.readFileSync(appPath, 'utf8');

appCode = appCode.replace(
`                const uploadPayload = {
                    identity_key: identity.public_key,
                    registration_id: identity.registration_id,
                    signed_pre_key: {
                        key_id: signedPreKey.key_id,
                        public_key: signedPreKey.public_key,
                        signature: signedPreKey.signature
                    },
                    one_time_keys: preKeys.map(k => ({
                        key_id: k.key_id,
                        public_key: k.public_key
                    }))
                };`,
`                const toUrlSafeNoPad = (b64: string) => b64.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
                
                const uploadPayload = {
                    identity_key: toUrlSafeNoPad(identity.public_key),
                    registration_id: identity.registration_id,
                    signed_pre_key: {
                        key_id: signedPreKey.key_id,
                        public_key: toUrlSafeNoPad(signedPreKey.public_key),
                        signature: toUrlSafeNoPad(signedPreKey.signature)
                    },
                    one_time_keys: preKeys.map(k => ({
                        key_id: k.key_id,
                        public_key: toUrlSafeNoPad(k.public_key)
                    }))
                };`);

fs.writeFileSync(appPath, appCode);

