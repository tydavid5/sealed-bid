# AI Usage, Sealed Bid

## Agent used

Muse, called Little 5, Meta's personal AI agent. It worked from the brief and concept pick of the human builder, Five (Taiwo John), in a chat session on Nov 14 to 15, 2026.

## Workflow

1. Five picked the concept, EN-A Sealed Bid, and the Advanced Encrypted Apps category.
2. Little 5 scaffolded the demo app with real ML-KEM-1024 encryption through QoreSeal 0.1.0, the test suite and the docs, and ran the tests locally.
3. Five generated the KEM keypair in the deploy page browser and backed up the secret key himself.
4. Registration of the recipient KEM key on chain was attempted and refused by QoreX, with the exact error recorded in the README. Five decided to submit with the gap labelled honestly.
5. Little 5 verified the on-chain state from the public REST API, then wrote the live status and the gap into the README and build report.
6. Five approved the demo video narration and the final submission.

## What the AI generated

- The demo web app (Vite, TypeScript, React) with real ML-KEM-1024 encryption and decryption, 1568 byte public key.
- The test suite, 8 tests, all passing.
- The deploy helper scripts and the deploy page used to coordinate the live steps.
- The README, BUILD-REPORT and STORYBOARD drafts, and the narration script for the demo video.

## Human contribution

- The concept, the category choice and every design decision.
- The KEM keypair generation and the secret key backup, done by Five in the browser.
- The decision to submit with the gap labelled honestly instead of claiming a registration that did not happen.
- Approval of the demo video and of the final submission.

## Verification and known gap

No key, hash or verification result in this repo was invented. The recipient KEM key is not published on chain: GET /qorechain/pqc/v1/kem/qor1kkmn9z3es9p3heet7y5zcrcg57g9ljp8909r5u returns found false, checked Nov 15 about 03:10 WAT. QoreX refused the registration with the exact error: QoreX: /qorechain.pqc.v1.MsgRegisterKEMKey is managed by the wallet itself, not by a website. The encryption is real and demoable locally, the on-chain registration is the known gap for this submission.
