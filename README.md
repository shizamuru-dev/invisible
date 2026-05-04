<div align="center">

```
██╗███╗   ██╗██╗   ██╗██╗███████╗██╗██████╗ ██╗     ███████╗
██║████╗  ██║██║   ██║██║██╔════╝██║██╔══██╗██║     ██╔════╝
██║██╔██╗ ██║██║   ██║██║███████╗██║██████╔╝██║     █████╗  
██║██║╚██╗██║╚██╗ ██╔╝██║╚════██║██║██╔══██╗██║     ██╔══╝  
██║██║ ╚████║ ╚████╔╝ ██║███████║██║██████╔╝███████╗███████╗
╚═╝╚═╝  ╚═══╝  ╚═══╝  ╚═╝╚══════╝╚═╝╚═════╝ ╚══════╝╚══════╝
```

### *The messenger that's here, just like your privacy — you know it exists, but no one else does.*

<br/>

[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/Built%20with-Tauri-blue?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Backend-Rust-CE422B?logo=rust)](https://www.rust-lang.org)
[![Version](https://img.shields.io/badge/Version-0.1.0-orange)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Glitched-Developers/invisible/pulls)

<br/>

> 👻 *A secure desktop messenger. It's not paranoia if they really are watching.*

</div>

---

## 🤔 What is this?

**Invisible** is a cross-platform desktop messenger that takes your privacy so seriously it considered not having a README at all (but then reconsidered, for your sake).

Every message is **end-to-end encrypted** — meaning even *we* can't read what you're sending. Plausible deniability: activated. NSA interest level: hopefully zero.

Built on top of [Tauri](https://tauri.app), it pairs a snappy **React + TypeScript** frontend with a **Rust** backend that handles the cryptographic heavy lifting. Think of it as Signal — if Signal went to the gym, learned Rust, and started using five different cryptographic algorithms just to prove a point.

---

## ✨ Features

| Feature | What it does | Our honest take |
|---------|-------------|-----------------|
| 🔒 **E2E Encryption** | Encrypts everything | Your secrets stay secret. We tried reading them. We failed. We respect it. |
| 💬 **Real-time Messaging** | Instant delivery | Faster than your excuse for not replying |
| 📁 **File Sharing** | Send any file | Your cloud provider won't judge your meme folder anymore |
| 👤 **Contact Management** | Manage your people | Unlike your phone contacts, ours actually work |
| 🎨 **Theme Support** | Light & dark mode | Dark mode included, because we respect your retinas |
| 🖥️ **Cross-platform** | Windows, macOS, Linux | We don't discriminate. We just encrypt differently. |

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| 🖥️ Desktop shell | [Tauri 2](https://tauri.app) | Electron was too heavy. We have standards. |
| ⚛️ Frontend | [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) | Because `any` is not a type, it's a cry for help |
| 🧩 UI Components | [Radix UI](https://www.radix-ui.com) + [Tailwind CSS](https://tailwindcss.com) | Beautiful and accessible, like us |
| 🔐 Crypto | X25519 · AES-GCM · Ed25519 · HKDF · HMAC · SHA-2 | We may have gone overboard. We regret nothing. |
| ⚡ Build tool | [Vite](https://vitejs.dev) | Webpack survivors will understand |
| 🦀 Backend | [Rust](https://www.rust-lang.org) | Memory-safe, blazing fast, and the compiler has more opinions than your tech lead |

> **🔐 Cryptography nerd corner:** X25519 for key exchange, AES-GCM for symmetric encryption, Ed25519 for signatures, HKDF for key derivation, HMAC for message integrity, SHA-2 for hashing. Yes, we went overboard. No, we are not sorry. The threat model demanded it and we enthusiastically agreed.

---

## 🎯 Why Invisible?

Because other messengers make you choose between **convenience** and **privacy**. We chose violence — er, we chose **both**.

```
Other apps:  "Your data is safe with us! 😇"
             [Meanwhile, in their data center: 👀📊💰]

Invisible:   "We literally cannot read your messages."
             [Meanwhile, in our data center: 🤷 ¯\_(ツ)_/¯]
```

If you've ever felt like your chat app was reading your messages before you even finished typing them — you were probably right. **Invisible** fixes that by making your messages mathematically unreadable to everyone except the person you're talking to. Math doesn't lie. (Unlike some Terms of Service we won't name.)

---

## 🚀 Getting Started

### Prerequisites

Before you begin, make sure you have the following installed:

- [Node.js](https://nodejs.org) **18+** — JavaScript runtime (yes, we use JS too, deal with it)
- [Rust](https://www.rust-lang.org/tools/install) **(stable)** — The language that makes you fight the compiler until you write correct code
- [Tauri CLI prerequisites](https://tauri.app/start/prerequisites/) — Varies by OS. Yes, it's a bit of a setup. No, it's not optional.

### Installation

```bash
# 1. Clone the repo (or download the zip if you're that person)
git clone https://github.com/Glitched-Developers/invisible.git
cd invisible

# 2. Install frontend dependencies
# (grab a coffee, npm install is doing its thing)
npm install

# 3. Copy and configure the environment
cp .env.example .env
# Fill in the blanks. Yes, all of them. No, you can't skip this.
# Edit .env with your backend URL and secrets

# 4. Launch in development mode
npm run tauri dev
# 🎉 If it compiles, congratulations. The Rust compiler approves of you.
```

### Building for Production

```bash
npm run tauri build
```

The installer bundle will appear in `src-tauri/target/release/bundle/`. You're welcome. It took Rust a few minutes to compile, but the result is worth it.

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and fill in your backend URL and any required secrets.

```
⚠️  DO NOT commit your .env file.
    Seriously. We've seen things. GitHub history is forever.
    Git blame is eternal. Your future self will thank you.
```

The backend that powers all of this lives here: **[invisible-backend](https://github.com/Glitched-Developers/invisible-backend/)**

---

## 🔐 Security

We take security seriously. Like, embarrassingly seriously.

- All messages use **end-to-end encryption** — your keys, your data
- Key exchange via **X25519** (Diffie-Hellman on Curve25519)
- Message encryption via **AES-256-GCM** (authenticated encryption)
- Identity signatures via **Ed25519** (fast, modern, battle-tested)
- Key derivation via **HKDF** with **SHA-2** (standards-compliant key stretching)
- Message authentication via **HMAC** (so nobody can tamper with messages in transit)

Found a security vulnerability? Please **don't** post it as a GitHub issue. Instead, contact us directly. We'd like to fix it quietly before the entire internet finds out. Thank you.

---

## 🗺️ Roadmap

Things we're planning (in optimistic order):

- [x] Core encrypted messaging
- [x] File sharing
- [x] Contact management  
- [x] Cross-platform support
- [ ] Group chats *(it's complicated — crypto-wise AND socially)*
- [ ] Voice & video calls *(more crypto, more fun)*
- [ ] Mobile apps *(Rust on mobile: an adventure)*
- [ ] Disappearing messages *(for when you said something you regret)*
- [ ] World peace *(stretch goal)*

---

## ❓ FAQ

**Q: Is this really secure?**  
A: We use the same elliptic-curve cryptography that banks and governments use. So yes, unless you have nation-state adversaries with quantum computers. In that case, you have bigger problems than your chat app.

**Q: Can you read my messages?**  
A: No. Architecturally impossible. The keys never leave your device. We are as blind as your ex pretending not to see your stories.

**Q: Why Rust for the backend?**  
A: Because C++ looked at us funny. Also: memory safety, performance, and the compiler basically acts as a pair programmer that refuses to let you ship bugs.

**Q: Why Tauri and not Electron?**  
A: Electron apps use about as much RAM as a small country's space program. Tauri gives us native binaries and webviews at a fraction of the cost. Your laptop's fan will thank us.

**Q: Is the app free?**  
A: Yes. We believe privacy shouldn't be a luxury.

**Q: Can I use this for [illegal thing]?**  
A: No. Read the license. Also: no.

---

## 🤝 Contributing

Found a bug? Have a feature idea? Want to add *even more* cryptographic algorithms to our already excessive stack?

Pull requests are welcome and encouraged! Please open an issue first so we can discuss it before you write 500 lines of beautiful code that goes in the wrong direction. (We've all been there.)

```bash
# The contributor's journey:
1. Fork the repo
2. Create your branch:  git checkout -b feat/something-cool
3. Make your changes    (with tests, please 🙏)
4. Commit:              git commit -m 'feat: add something cool'
5. Push:                git push origin feat/something-cool
6. Open a Pull Request  (and wait for constructive arguments)
```

**Code style:** We use TypeScript with strict mode. The Rust code is linted with `clippy`. If `clippy` is unhappy, we are unhappy.

---

## 👥 Authors & Contributors

<div align="center">

| Role | Person |
|------|--------|
| 🏢 Organization | [@Glitched-Developers](https://github.com/Glitched-Developers) |
| 🧠 Core Team | [Shizamuru](https://github.com/shizamuru-dev) · [VladN13](https://github.com/VladN13) · [vovakovtyn2008-oss](https://github.com/vovakovtyn2008-oss) |

*And everyone else who opened an issue, submitted a PR, or simply starred the repo at 2 AM.*

</div>

---

## 📄 License

Licensed under the **[Mozilla Public License 2.0](LICENSE)**.

**TL;DR:** Open source. Share improvements back. Don't relicense as proprietary. The lawyers made us write the long version, but this is the spirit of it. We trust you.

---

<div align="center">

### 👻 Stay invisible. Stay safe.

<br/>

*Made with ☕ coffee, 🦀 Rust, 🔐 cryptographic paranoia,*  
*and the firm belief that privacy is a human right — not a premium feature.*

<br/>

**[⭐ Star us on GitHub](https://github.com/Glitched-Developers/invisible)** — it's the only tracking we'll ever ask you to enable.

</div>
