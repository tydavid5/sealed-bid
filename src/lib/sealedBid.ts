import { sha3_256 } from "@noble/hashes/sha3";
import {
  ML_KEM_1024_PUBLIC_KEY_LENGTH,
  buildRegisterKemKeyMessage,
  envelopeFromText,
  envelopeToText,
  generateSealKeys,
  open,
  recipientOf,
  seal,
  validateMlkemPublicKey,
  type SealKeyPair,
} from "@qorechain/qoreseal";
import {
  addressFromPublicKey,
  deriveCanonicalPqKey,
  deriveClassicalKey,
  signMessage,
  verifyMessage,
  type ClassicalKey,
  type MessageSignature,
  type PqKeyPair,
} from "@qorechain/qoresign";
import { hex } from "@scure/base";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

/** BIP-39 English words as an array, whatever shape the installed file ships. */
const ENGLISH_WORDS: string[] = Array.isArray(wordlist)
  ? (wordlist as string[])
  : String(wordlist).trim().split("\n");

/**
 * Sealed Bid core: real ML-KEM-1024 encryption through QoreSeal 0.1.0,
 * ML-DSA-87 key binding through QoreSign 0.1.0, and a small auction state
 * machine that refuses to read any bid before close.
 *
 * Chain facts: testnet qorechain-diana, EVM chain id 9800. Demo mode runs
 * entirely in the browser with keys held in memory only. No key, seed or
 * mnemonic is ever written to disk, local storage or the network by this
 * module. Known gap, checked Nov 15 about 03:10 WAT: the recipient KEM key
 * is not published on chain, GET /qorechain/pqc/v1/kem/qor1kkmn9z3es9p3heet7y5zcrcg57g9ljp8909r5u
 * returns found false, and QoreX refused the registration.
 */

export const CHAIN_ID = "qorechain-diana";
export const EVM_CHAIN_ID = 9800;
export const PURPOSE = "sealed-bid";
export const KEM_ALGORITHM_ID = 2;
export const ML_KEM_PUBLIC_KEY_LENGTH = ML_KEM_1024_PUBLIC_KEY_LENGTH;

export class BidSealedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BidSealedError";
  }
}

export class BindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BindingError";
  }
}

export interface Identity {
  mnemonic: string;
  address: string;
  classicalKey: ClassicalKey;
  pqKey: PqKeyPair;
  sealKeys: SealKeyPair;
}

export interface PublicIdentity {
  address: string;
  mlkemPublicKey: Uint8Array;
  pqPublicKey: Uint8Array;
}

export interface BidPlaintext {
  auctionId: string;
  amountCents: number;
  currency: string;
  bidder: string;
}

export type AuctionStatus = "open" | "closed" | "revealed";

export interface SealedBidRecord {
  id: string;
  bidderAddress: string;
  envelopeText: string;
  bindingSignature: MessageSignature;
  bindingText: string;
  submittedAt: string;
  revealedAmountCents: number | null;
}

export interface Auction {
  id: string;
  title: string;
  item: string;
  reserveCents: number;
  status: AuctionStatus;
  bids: SealedBidRecord[];
  winnerBidId: string | null;
  winnerAmountCents: number | null;
}

export function publicIdentityOf(identity: Identity): PublicIdentity {
  return {
    address: identity.address,
    mlkemPublicKey: identity.sealKeys.mlkemPublicKey,
    pqPublicKey: identity.pqKey.publicKey,
  };
}

/** Create a fresh demo identity. Keys live in memory only. */
export function createDemoIdentity(): Identity {
  const mnemonic = generateMnemonic(ENGLISH_WORDS, 256);
  const classicalKey = deriveClassicalKey({ mnemonic });
  const address = addressFromPublicKey(classicalKey.publicKey, "secp256k1").bech32;
  const pqKey = deriveCanonicalPqKey({ mnemonic, address });
  const sealKeys = generateSealKeys();
  validateMlkemPublicKey(sealKeys.mlkemPublicKey);
  return { mnemonic, address, classicalKey, pqKey, sealKeys };
}

/** SHA3-256 hex of an ML-KEM-1024 public key, as used on the key registry. */
export function mlkemKeyHashHex(mlkemPublicKey: Uint8Array): string {
  return hex.encode(sha3_256(mlkemPublicKey));
}

/**
 * Canonical binding text. Signing it with ML-DSA-87 binds the ML-KEM-1024
 * key to the auction and the bidder address, so a bid sealed to a different
 * key cannot be passed off as this bidder's bid.
 */
export function bindingText(auctionId: string, address: string, mlkemPublicKey: Uint8Array): string {
  return [
    "Sealed Bid key binding v1",
    `chain: ${CHAIN_ID}`,
    `auction: ${auctionId}`,
    `bidder: ${address}`,
    `mlkem-1024 key sha3: ${mlkemKeyHashHex(mlkemPublicKey)}`,
  ].join("\n");
}

/** Sign the key binding with the hybrid secp256k1 plus ML-DSA-87 signature. */
export function signBinding(identity: Identity, auctionId: string): { text: string; signature: MessageSignature } {
  const text = bindingText(auctionId, identity.address, identity.sealKeys.mlkemPublicKey);
  const signature = signMessage({
    chainId: CHAIN_ID,
    signer: identity.address,
    data: text,
    classicalKey: identity.classicalKey,
    pqKey: identity.pqKey,
  });
  return { text, signature };
}

/** Verify an ML-DSA-87 key binding. Throws BindingError when it does not check out. */
export function verifyBinding(publicIdentity: PublicIdentity, auctionId: string, text: string, signature: MessageSignature): void {
  const expected = bindingText(auctionId, publicIdentity.address, publicIdentity.mlkemPublicKey);
  if (text !== expected) {
    throw new BindingError("Binding text does not match the auction, bidder and bound ML-KEM key.");
  }
  try {
    verifyMessage({
      chainId: CHAIN_ID,
      signer: publicIdentity.address,
      data: text,
      signature,
      pqPublicKey: publicIdentity.pqPublicKey,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new BindingError(`ML-DSA-87 binding verification failed: ${detail}`);
  }
}

/** The on chain registry message that would register this ML-KEM key. Built, not broadcast, in demo mode. */
export function registerKemKeyMessage(identity: Identity): { typeUrl: string; valueLength: number } {
  const message = buildRegisterKemKeyMessage({
    sender: identity.address,
    mlkemPublicKey: identity.sealKeys.mlkemPublicKey,
  });
  return { typeUrl: message.typeUrl, valueLength: message.value.length };
}

function encodeBid(bid: BidPlaintext): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(bid));
}

function decodeBid(bytes: Uint8Array): BidPlaintext {
  return JSON.parse(new TextDecoder().decode(bytes)) as BidPlaintext;
}

function aadFor(auctionId: string): Uint8Array {
  return new TextEncoder().encode(`sealed-bid|${CHAIN_ID}|${auctionId}`);
}

/**
 * Seal one bid to the auction address with ML-KEM-1024 only (QoreSeal mode
 * "mlkem"). The returned text is a qoreseal envelope. Nobody holding only
 * the envelope can read the amount.
 */
export function sealBidAmount(identity: Identity, auctionId: string, amountCents: number): string {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Bid amount must be a whole number of cents above zero.");
  }
  const bid: BidPlaintext = {
    auctionId,
    amountCents,
    currency: "fUSD",
    bidder: identity.address,
  };
  const envelope = seal({
    chainId: CHAIN_ID,
    purpose: PURPOSE,
    recipients: [recipientOf(identity.sealKeys)],
    plaintext: encodeBid(bid),
    aad: aadFor(auctionId),
    mode: "mlkem",
  });
  return envelopeToText(envelope);
}

/** Open a sealed bid. Only the auction address key holder can do this. */
export function openBidAmount(identity: Identity, envelopeText: string, auctionId: string): BidPlaintext {
  const envelope = envelopeFromText(envelopeText);
  const plaintext = open({
    chainId: CHAIN_ID,
    purpose: PURPOSE,
    envelope,
    keys: identity.sealKeys,
    aad: aadFor(auctionId),
  });
  const bid = decodeBid(plaintext);
  if (bid.auctionId !== auctionId) {
    throw new Error("Bid belongs to a different auction.");
  }
  return bid;
}

/** Short preview of an envelope for display. Never a decryption. */
export function envelopePreview(envelopeText: string, chars = 48): string {
  return envelopeText.length > chars ? `${envelopeText.slice(0, chars)}...` : envelopeText;
}

export function createAuction(title: string, item: string, reserveCents: number): Auction {
  const id = `auction-${Date.now().toString(36)}`;
  return {
    id,
    title,
    item,
    reserveCents,
    status: "open",
    bids: [],
    winnerBidId: null,
    winnerAmountCents: null,
  };
}

/**
 * Submit one encrypted bid. The binding is verified first, then the bid is
 * stored as ciphertext only. The amount is never stored in plain text while
 * the auction is open.
 */
export function submitBid(
  auction: Auction,
  identity: Identity,
  amountCents: number,
): { auction: Auction; bid: SealedBidRecord } {
  if (auction.status !== "open") {
    throw new BidSealedError("This auction is not open for bids.");
  }
  const { text, signature } = signBinding(identity, auction.id);
  verifyBinding(publicIdentityOf(identity), auction.id, text, signature);
  const envelopeText = sealBidAmount(identity, auction.id, amountCents);
  const bid: SealedBidRecord = {
    id: `bid-${auction.bids.length + 1}`,
    bidderAddress: identity.address,
    envelopeText,
    bindingSignature: signature,
    bindingText: text,
    submittedAt: new Date().toISOString(),
    revealedAmountCents: null,
  };
  return {
    auction: { ...auction, bids: [...auction.bids, bid] },
    bid,
  };
}

/** Close the auction. Bids stay sealed until reveal runs. */
export function closeAuction(auction: Auction): Auction {
  if (auction.status !== "open") {
    throw new BidSealedError("Only an open auction can be closed.");
  }
  return { ...auction, status: "closed" };
}

/**
 * Read one bid. Refuses while the auction is open, so a bid cannot be read
 * before close even by the auction address key holder.
 */
export function readBid(auction: Auction, bidId: string, identity: Identity): BidPlaintext {
  if (auction.status === "open") {
    throw new BidSealedError("Bid is sealed. It cannot be read before the auction closes.");
  }
  const bid = auction.bids.find((entry) => entry.id === bidId);
  if (!bid) {
    throw new Error("Bid not found.");
  }
  return openBidAmount(identity, bid.envelopeText, auction.id);
}

/**
 * Reveal every bid after close and pick the highest bid at or above the
 * reserve as the winner. Returns the updated auction and the revealed bids.
 */
export function revealBids(
  auction: Auction,
  identity: Identity,
): { auction: Auction; revealed: BidPlaintext[] } {
  if (auction.status !== "closed") {
    throw new BidSealedError("Bids can only be revealed after the auction is closed.");
  }
  const revealed: BidPlaintext[] = [];
  const bids = auction.bids.map((bid) => {
    const plain = openBidAmount(identity, bid.envelopeText, auction.id);
    revealed.push(plain);
    return { ...bid, revealedAmountCents: plain.amountCents };
  });
  let winnerBidId: string | null = null;
  let winnerAmountCents: number | null = null;
  for (const bid of bids) {
    const amount = bid.revealedAmountCents ?? 0;
    if (amount >= auction.reserveCents && (winnerAmountCents === null || amount > winnerAmountCents)) {
      winnerBidId = bid.id;
      winnerAmountCents = amount;
    }
  }
  return {
    auction: {
      ...auction,
      status: "revealed",
      bids,
      winnerBidId,
      winnerAmountCents,
    },
    revealed,
  };
}

export function formatCents(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`;
}
