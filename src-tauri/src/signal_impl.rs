use base64::{engine::general_purpose::STANDARD as b64, Engine as _};
use serde::{Deserialize, Serialize};

// ==============================================
//  Data Structures mimicking LibSignal API
// ==============================================

#[derive(Serialize, Deserialize, Clone)]
pub struct IdentityKeyPair {
    pub public_key: String,  // Base64 X25519 Public Key
    pub private_key: String, // Base64 X25519 Static Secret
    pub registration_id: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PreKeyRecord {
    pub key_id: u32,
    pub public_key: String,
    pub private_key: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SignedPreKeyRecord {
    pub key_id: u32,
    pub public_key: String,
    pub private_key: String,
    pub signature: String, // Base64 signature of public_key using IdentityKey
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PreKeyBundle {
    pub identity_key: String,
    pub registration_id: u32,
    pub signed_pre_key_id: u32,
    pub signed_pre_key_public: String,
    pub signed_pre_key_signature: String,
    pub pre_key_id: Option<u32>,
    pub pre_key_public: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PreKeyWhisperMessage {
    pub registration_id: u32,
    pub pre_key_id: Option<u32>,
    pub signed_pre_key_id: u32,
    pub base_key: String,
    pub identity_key: String,
    pub message: WhisperMessage,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct WhisperMessage {
    pub ciphertext: String,
    pub mac: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SessionState {
    pub remote_identity_key: String,
    pub root_key: String,
    pub chain_key: String,
    pub sending_chain_key: String,
    pub receiving_chain_key: String,
    pub my_ephemeral_private: String,
    pub their_ephemeral_public: String,
}

// Helpers
pub fn b64_encode(data: &[u8]) -> String {
    b64.encode(data)
}

pub fn b64_decode(data: &str) -> Result<Vec<u8>, String> {
    b64.decode(data).map_err(|e| e.to_string())
}
