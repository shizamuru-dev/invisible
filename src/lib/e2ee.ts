import { invoke } from '@tauri-apps/api/core';

export interface IdentityKeyPair {
  public_key: string;
  private_key: string;
  registration_id: number;
}

export interface PreKeyRecord {
  key_id: number;
  public_key: string;
  private_key: string;
}

export interface SignedPreKeyRecord {
  key_id: number;
  public_key: string;
  private_key: string;
  signature: string;
}

export interface PreKeyBundle {
  identity_key: string;
  registration_id: number;
  signed_pre_key_id: number;
  signed_pre_key_public: string;
  signed_pre_key_signature: string;
  pre_key_id?: number;
  pre_key_public?: string;
}

export interface WhisperMessage {
  ciphertext: string;
  mac: string;
}

export interface PreKeyWhisperMessage {
  registration_id: number;
  pre_key_id?: number;
  signed_pre_key_id: number;
  base_key: string;
  identity_key: string;
  message: WhisperMessage;
}

export class E2EE {
  static async generateIdentity(): Promise<IdentityKeyPair> {
    return await invoke('signal_generate_identity');
  }

  static async generatePreKeys(): Promise<PreKeyRecord[]> {
    return await invoke('signal_generate_pre_keys');
  }

    static async generateSignedPreKey(_identityKeyPair: IdentityKeyPair, signedPreKeyId: number): Promise<SignedPreKeyRecord> {
    const ecdhPair = await window.crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"]
    );
    
    const pubBuffer = await window.crypto.subtle.exportKey("raw", ecdhPair.publicKey);
    const pubB64 = btoa(String.fromCharCode(...new Uint8Array(pubBuffer)));

    const privBuffer = await window.crypto.subtle.exportKey("pkcs8", ecdhPair.privateKey);
    const privB64 = btoa(String.fromCharCode(...new Uint8Array(privBuffer)));

    let signatureB64 = "";
    try {
        const privKeyBytes = Uint8Array.from(atob(_identityKeyPair.private_key), c => c.charCodeAt(0));
        const signingKey = await window.crypto.subtle.importKey(
            "pkcs8",
            privKeyBytes,
            { name: "ECDSA", namedCurve: "P-256" },
            false,
            ["sign"]
        );
        const signature = await window.crypto.subtle.sign(
            { name: "ECDSA", hash: { name: "SHA-256" } },
            signingKey,
            pubBuffer
        );
        signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
    } catch (e) {
        console.error("Failed to sign pre-key with identity key:", e);
        throw new Error(`Failed to sign pre-key: ${e instanceof Error ? e.message : String(e)}`);
    }

    return {
      key_id: signedPreKeyId,
      public_key: pubB64,
      private_key: privB64,
      signature: signatureB64
    };
  }

  static async processPreKeyBundle(_remoteAddress: string, bundle: PreKeyBundle): Promise<void> {
    await invoke('signal_build_session', { bundle });
  }

  static async encryptMessage(remoteAddress: string, message: string): Promise<PreKeyWhisperMessage> {
    return await invoke('signal_encrypt', { message, remoteId: remoteAddress });
  }

  static async decryptMessage(_remoteAddress: string, whisper: PreKeyWhisperMessage): Promise<string> {
    return await invoke('signal_decrypt', { whisper });
  }
}
