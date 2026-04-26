import { useEffect, useRef, useState } from 'react';
import { ApiClient } from '../lib/apiClient';
import { E2EE } from '../lib/e2ee';

export function useE2EEInit(initialToken: string, initialUsername: string) {
    const [token, setToken] = useState<string | null>(initialToken);
    const [myUsername, setMyUsername] = useState<string | null>(initialUsername);
    const [myNickname, setMyNickname] = useState<string>(initialUsername);
    const initRef = useRef(false);

    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;
        let isMounted = true;
        
        const init = async () => {
            if (!initialToken || !initialUsername) return;
            try {
                const identity = await E2EE.generateIdentity();
                const preKeys = await E2EE.generatePreKeys();
                const signedPreKey = await E2EE.generateSignedPreKey(identity, 0);

                const toUrlSafeNoPad = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                
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
                };

                await ApiClient.uploadKeys(initialToken, uploadPayload);

                if (isMounted) {
                    setToken(initialToken);
                    setMyUsername(initialUsername);
                    setMyNickname(initialUsername);
                }
            } catch (err) {
                console.error("Init failed:", err);
            }
        };

        init();
        return () => { isMounted = false; };
    }, [initialToken, initialUsername]);

    return { token, setToken, myUsername, setMyUsername, myNickname, setMyNickname };
}
