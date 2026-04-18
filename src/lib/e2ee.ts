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
    // Mock because there is no generate_signed_pre_key in rust yet
    const mockPub = new Uint8Array(32);
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
