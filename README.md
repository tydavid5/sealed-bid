# Sealed Bid

Open bids let others copy your price.

## Live testnet status, Nov 15 2026

GAP, labelled honestly. The recipient KEM key is not published on chain. GET /qorechain/pqc/v1/kem/qor1kkmn9z3es9p3heet7y5zcrcg57g9ljp8909r5u returns found false, checked Nov 15 about 03:10 WAT. The encryption is real and demoable locally: real ML-KEM-1024 encryption through QoreSeal 0.1.0, 1568 byte public key, 8 tests pass. A keypair was generated in the deploy page browser Nov 15 about 03:07 WAT, and the secret key was backed up by Five, location not shared. QoreX refused the registration, with the exact error: QoreX: /qorechain.pqc.v1.MsgRegisterKEMKey is managed by the wallet itself, not by a website. The only documented route left is the SDK hybrid TxClient script sealed-bid-register.mjs, and that script route was not run for this submission. That is the known gap for this submission. Live demo: https://sealed-bid-iota.vercel.app

Sealed Bid is a sealed bid auction on QoreChain testnet. A bidder encrypts one bid with ML-KEM-1024 to the auction address, the key is bound to the auction with an ML-DSA-87 signature, and the bid is shown on screen as ciphertext only. Nobody can read the amount before close, not even the auction address key holder, because the app refuses every read while the auction is open. After close, the app decrypts every bid and reveals the highest bid at or above the reserve as the winner.

## How it works

1. Create an auction. The app generates a demo identity in the browser: a classical secp256k1 key, a canonical ML-DSA-87 key, and a QoreSeal ML-KEM-1024 key pair. Keys live in memory only and are never written to disk, local storage or the network.
2. Register the recipient key. The app builds the on chain registry message, `MsgRegisterKEMKey`, type URL `/qorechain.pqc.v1.MsgRegisterKEMKey`, algorithm id 2 for ML-KEM-1024. In demo mode the message is built and shown, not broadcast. The on chain registration was attempted on Nov 15 and QoreX refused it, see Live testnet status, Nov 15 2026 above.
3. Seal a bid. The bidder signs a key binding with the hybrid secp256k1 plus ML-DSA-87 signature, the binding is verified, then QoreSeal seals the bid with ML-KEM-1024 only, mode `mlkem`, purpose `sealed-bid`, chain `qorechain-diana`. The bid is stored and displayed as a `qoreseal:` envelope, ciphertext only.
4. Try to read it early. The "Try to read it early" button calls the same read path the reveal uses, and the app blocks it while the auction is open.
5. Close, then reveal. Closing stops new bids. Reveal decrypts every envelope with the auction address key and names the highest bid at or above the reserve as the winner.

## What it does

- One flow end to end: create an auction, submit one encrypted bid in demo mode, show the bid as ciphertext, close the auction, decrypt and reveal the winner.
- Real ML-KEM-1024 encryption through QoreSeal 0.1.0, mode `mlkem`, 1568 byte public key, 1568 byte ciphertext.
- Real ML-DSA-87 key binding through QoreSign 0.1.0, hybrid signature over a canonical binding text that names the chain, the auction, the bidder address and the SHA3-256 of the ML-KEM-1024 key.
- Registered recipient keys: the registry message is built with QoreSeal `buildRegisterKemKeyMessage`. Live registration on chain did not happen, QoreX refused it, see Live testnet status, Nov 15 2026 above. The ML-DSA-87 key is registered true, verified Nov 15.
- Client side encryption and decryption, all in the browser, no server.
- A bid cannot be read before close, enforced in the auction state machine and covered by tests.
- Deep navy with soft gold styling, sealed envelope mark, ciphertext shown as a sealed card.

## How to run it

```sh
npm install
npm run dev
```

Open http://localhost:5173 and run the three steps on screen.

```sh
npm test
npm run build
npm run preview
```

## Kits used

- `@qorechain/sdk` 0.14.0, scaffolded with `npx create-qorechain-dapp` CLI 0.14.0, template `fullstack-web`, TypeScript. The SDK client connects to testnet and reports the network.
- `@qorechain/qoreseal` 0.1.0, ML-KEM-1024 encryption, key registry message, envelope codec. Used for real, not substituted.
- `@qorechain/qoresign` 0.1.0, ML-DSA-87 hybrid signing and verification for the key binding.
- `@qorechain/pqc` 0.2.3, the published post quantum primitives package. Note: the bare package name `qorechain-pqc` from the brief does not exist on npm, it returns 404. The published name is `@qorechain/pqc`, and that is what QoreSeal itself depends on.
- Vite 5 plus React 18 plus TypeScript 5, vitest 2 for tests.

## Testnet contracts and addresses

- Network: testnet `qorechain-diana`, EVM chain id 9800.
- REST: https://api-testnet.qore.host. EVM RPC: https://evm-testnet.qore.host.
- Faucet: dashboard.qorechain.io/faucet, fest tokens fUSD, fETH and fBTC once every 24 hours.
- Docs: docs.qorechain.io, SDK quickstart at docs.qorechain.io/sdk/quickstart, tutorials at docs.qorechain.io/build-before-qday.
- Auction contract address: none deployed. QoreX wallet address is qor1kkmn9z3es9p3heet7y5zcrcg57g9ljp8909r5u (Native) and 0xB5b7328A3981431BE72bF1282c0F08A7905fC827 (EVM form, same identity). Verified live Nov 15 with qore-cli on testnet qorechain-diana chain 9800: fresh account at first check, exists false, balances empty, 0 QOR, staked 0 QOR, ML-DSA-87 key not registered yet. Faucet claimed Nov 15 01:00 WAT: exists true, account number 15585, sequence 0, 100 QOR. ML-DSA-87 key registration completed Nov 15 01:13 WAT, verified live: ML-DSA-87 key registered true, sequence 2, balance 99.85 QOR after 0.15 QOR in fees, EVM window found false. The remaining live step is the on chain KEM key registration, which QoreX refused, see Live testnet status, Nov 15 2026 above. No transaction hash exists yet. Demo mode runs the full flow in the browser.
- QoreX wallet address: qor1kkmn9z3es9p3heet7y5zcrcg57g9ljp8909r5u (Native) and 0xB5b7328A3981431BE72bF1282c0F08A7905fC827 (EVM form, same identity). Do not invent one. Verified live Nov 15 with qore-cli on testnet qorechain-diana chain 9800: fresh account at first check, exists false, balances empty, 0 QOR, staked 0 QOR, ML-DSA-87 key not registered yet. Faucet claimed Nov 15 01:00 WAT: exists true, account number 15585, sequence 0, 100 QOR. ML-DSA-87 key registration completed Nov 15 01:13 WAT, verified live: ML-DSA-87 key registered true, sequence 2, balance 99.85 QOR, EVM window found false. The remaining live step is the on chain KEM key registration, which QoreX refused, see Live testnet status, Nov 15 2026 above.

## Demo mode, stated plainly

Demo mode uses keys generated in the browser for the session. It proves the encryption, the binding, the sealed state and the reveal. It does not prove an on chain bid, because no transaction is sent without Five's wallet. The UI labels demo mode on every screen.

## Project layout

- `src/lib/sealedBid.ts`, encryption, key binding and the auction state machine.
- `src/lib/sealedBid.test.ts`, 8 unit tests.
- `src/App.tsx`, the web app, three steps plus run log and network panel.
- `featured.png`, featured image, 1600 by 900, generated by `scripts/featured-image.py`.
- `BUILD-REPORT.md`, exact checks, numbers and what is blocked.
- `STORYBOARD.md`, demo video storyboard, five beats.

## License

MIT. See `LICENSE`.
