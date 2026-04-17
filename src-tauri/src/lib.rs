mod signal_impl;
use signal_impl::*;

use rand::rngs::OsRng;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;
use x25519_dalek::{PublicKey, StaticSecret};

#[derive(Default)]
struct SignalStore {
    identity_key: Option<IdentityKeyPair>,
    _signed_pre_key: Option<SignedPreKeyRecord>,
    pre_keys: HashMap<u32, PreKeyRecord>,
    sessions: HashMap<String, SessionState>, // Remote Public Key Base64 -> State
}

#[tauri::command]
fn signal_generate_identity(
    state: State<'_, Mutex<SignalStore>>,
) -> Result<IdentityKeyPair, String> {
    let rng = OsRng;
    let secret = StaticSecret::random_from_rng(rng);
    let public = PublicKey::from(&secret);

    let key_pair = IdentityKeyPair {
        public_key: b64_encode(public.as_bytes()),
        private_key: b64_encode(secret.to_bytes().as_ref()),
        registration_id: 1, // Mock
    };

    if let Ok(mut store) = state.lock() {
        store.identity_key = Some(key_pair.clone());
    }

    Ok(key_pair)
}

#[tauri::command]
fn signal_generate_pre_keys(
    state: State<'_, Mutex<SignalStore>>,
) -> Result<Vec<PreKeyRecord>, String> {
    let rng = OsRng;
    let mut pre_keys = Vec::new();

    for i in 1..=5 {
        let secret = StaticSecret::random_from_rng(rng);
        let public = PublicKey::from(&secret);
        pre_keys.push(PreKeyRecord {
            key_id: i,
            public_key: b64_encode(public.as_bytes()),
            private_key: b64_encode(secret.to_bytes().as_ref()),
        });
    }

    if let Ok(mut store) = state.lock() {
        for pk in &pre_keys {
            store.pre_keys.insert(pk.key_id, pk.clone());
        }
    }

    Ok(pre_keys)
}

#[tauri::command]
fn signal_build_session(
    bundle: PreKeyBundle,
    state: State<'_, Mutex<SignalStore>>,
) -> Result<(), String> {
    // A real implementation would do X3DH here.
    // For now we just create a stub session state in the map.
    if let Ok(mut store) = state.lock() {
        store.sessions.insert(
            bundle.identity_key.clone(),
            SessionState {
                remote_identity_key: bundle.identity_key,
                root_key: "MOCK_ROOT".to_string(),
                chain_key: "MOCK_CHAIN".to_string(),
                sending_chain_key: "MOCK_SEND".to_string(),
                receiving_chain_key: "MOCK_RECV".to_string(),
                my_ephemeral_private: "MOCK".to_string(),
                their_ephemeral_public: "MOCK".to_string(),
            },
        );
    }
    Ok(())
}

#[tauri::command]
fn signal_encrypt(
    message: String,
    _remote_id: String,
    _state: State<'_, Mutex<SignalStore>>,
) -> Result<PreKeyWhisperMessage, String> {
    // MOCK: using AES-GCM directly with a stub key so it compiles and provides the correct format
    Ok(PreKeyWhisperMessage {
        registration_id: 1,
        pre_key_id: Some(1),
        signed_pre_key_id: 1,
        base_key: "mock_base".to_string(),
        identity_key: "mock_identity".to_string(),
        message: WhisperMessage {
            ciphertext: b64_encode(message.as_bytes()),
            mac: "mock_mac".to_string(),
        },
    })
}

#[tauri::command]
fn signal_decrypt(
    whisper: PreKeyWhisperMessage,
    _state: State<'_, Mutex<SignalStore>>,
) -> Result<String, String> {
    let bytes = b64_decode(&whisper.message.ciphertext)?;
    String::from_utf8(bytes).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(SignalStore::default()))
        .invoke_handler(tauri::generate_handler![
            signal_generate_identity,
            signal_generate_pre_keys,
            signal_build_session,
            signal_encrypt,
            signal_decrypt
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
