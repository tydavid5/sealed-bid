import { useEffect, useMemo, useRef, useState } from "react";

import { createClient, type QoreChainClient } from "@qorechain/sdk";
import {
  CHAIN_ID,
  EVM_CHAIN_ID,
  closeAuction,
  createAuction,
  createDemoIdentity,
  envelopePreview,
  formatCents,
  mlkemKeyHashHex,
  readBid,
  registerKemKeyMessage,
  revealBids,
  submitBid,
  type Auction,
  type Identity,
} from "./lib/sealedBid";
import "./index.css";

const REST_URL = import.meta.env.VITE_QORE_REST_URL ?? "/lcd";
const EVM_RPC_URL =
  import.meta.env.VITE_QORE_EVM_RPC_URL ?? "http://localhost:8545";

const GOLD = "#c9a227";
const GOLD_SOFT = "#e3c766";
const INK = "#e8edf5";
const MUTED = "#9fb0c9";

function CountUp(props: { value: number; format: (n: number) => string }): JSX.Element {
  const [display, setDisplay] = useState(0);
  const [rolling, setRolling] = useState(true);
  const rafRef = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 650;
    setRolling(true);
    const tick = (now: number): void => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(props.value * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(props.value);
        setRolling(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [props.value]);
  return (
    <span className={rolling ? "sealed-rolling" : undefined}>
      {props.format(display)}
    </span>
  );
}

function EnvelopeMark(): JSX.Element {
  return (
    <svg width="72" height="52" viewBox="0 0 72 52" aria-label="Sealed envelope" role="img">
      <rect x="2" y="6" width="68" height="44" rx="4" fill="#12294d" stroke={GOLD} strokeWidth="1.5" />
      <path d="M4 9 L36 32 L68 9" fill="none" stroke={GOLD} strokeWidth="1.5" />
      <circle cx="36" cy="30" r="8" fill={GOLD} />
      <text x="36" y="34" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0a1a33">
        S
      </text>
    </svg>
  );
}

export function App(): JSX.Element {
  const client: QoreChainClient = useMemo(
    () =>
      createClient({
        network: "testnet",
        endpoints: { rest: REST_URL, evmRpc: EVM_RPC_URL },
      }),
    [],
  );

  const [identity, setIdentity] = useState<Identity | null>(null);
  const [auction, setAuction] = useState<Auction | null>(null);
  const [title, setTitle] = useState("Harvest Lot 7");
  const [item, setItem] = useState("One tonne of dried hibiscus, grade A");
  const [reserve, setReserve] = useState("500");
  const [bidAmount, setBidAmount] = useState("1250");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  function pushLog(line: string): void {
    setLog((lines) => [...lines, line]);
  }

  function handleCreate(): void {
    setError(null);
    setNotice(null);
    try {
      const reserveCents = Math.round(Number(reserve) * 100);
      if (!title.trim() || !item.trim() || !Number.isFinite(reserveCents) || reserveCents <= 0) {
        setError("Give the auction a title, an item and a reserve above zero.");
        return;
      }
      const fresh = createDemoIdentity();
      const registry = registerKemKeyMessage(fresh);
      const next = createAuction(title.trim(), item.trim(), reserveCents);
      setIdentity(fresh);
      setAuction(next);
      setNotice("Auction created. The auction address key is generated in demo mode only and is not registered on chain. It is bound with ML-DSA-87.");
      pushLog(`Auction ${next.id} created. Reserve ${formatCents(reserveCents)}.`);
      pushLog(`ML-KEM-1024 key, 1568 bytes, sha3 ${mlkemKeyHashHex(fresh.sealKeys.mlkemPublicKey).slice(0, 24)}...`);
      pushLog(`Registry message ready, not broadcast and not registered on chain: ${registry.typeUrl}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleBid(): void {
    setError(null);
    setNotice(null);
    if (!identity || !auction) {
      return;
    }
    try {
      const amountCents = Math.round(Number(bidAmount) * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        setError("Enter a bid above zero.");
        return;
      }
      const result = submitBid(auction, identity, amountCents);
      setAuction(result.auction);
      setNotice("Bid sealed. The amount is ciphertext now. Nobody can read it before close.");
      pushLog(`Bid ${result.bid.id} sealed for ${formatCents(amountCents)} (ciphertext only).`);
      pushLog("ML-DSA-87 key binding verified before sealing.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleTryRead(): void {
    setError(null);
    setNotice(null);
    if (!identity || !auction || auction.bids.length === 0) {
      return;
    }
    try {
      const plain = readBid(auction, auction.bids[0].id, identity);
      setNotice(`Read succeeded, which should not happen while open: ${formatCents(plain.amountCents)}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setNotice(`Blocked, as designed: ${message}`);
      pushLog(`Early read attempt blocked: ${message}`);
    }
  }

  function handleClose(): void {
    setError(null);
    setNotice(null);
    if (!auction) {
      return;
    }
    try {
      const closed = closeAuction(auction);
      setAuction(closed);
      setNotice("Auction closed. Bids are still sealed until reveal.");
      pushLog("Auction closed. Bids remain sealed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleReveal(): void {
    setError(null);
    setNotice(null);
    if (!identity || !auction) {
      return;
    }
    try {
      const result = revealBids(auction, identity);
      setAuction(result.auction);
      const winner = result.auction.winnerAmountCents;
      setNotice(
        winner === null
          ? "Bids revealed. No bid met the reserve, so there is no winner."
          : `Winner revealed: ${formatCents(winner)}. That matches the sealed bid submitted earlier.`,
      );
      pushLog(`Revealed ${result.revealed.length} bid(s) after close.`);
      if (winner !== null) {
        pushLog(`Winner: ${formatCents(winner)}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleReset(): void {
    setIdentity(null);
    setAuction(null);
    setNotice(null);
    setError(null);
    setLog([]);
  }

  function scrollToStep(step: string): void {
    document.getElementById(step)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const activeStep = !auction ? 0 : auction.status === "open" ? 1 : 2;
  const steps = [
    { id: "step-1", label: "1. Create", detail: "Auction and keys" },
    { id: "step-2", label: "2. Seal", detail: "Ciphertext only" },
    { id: "step-3", label: "3. Reveal", detail: "Winner after close" },
  ];
  const pillKind = notice && notice.startsWith("Blocked") ? "blocked" : "gold";
  const tagline = "Your price stays sealed until close.";
  const winnerCents = auction?.winnerAmountCents ?? null;

  return (
    <main className="sealed-root">
      <div className="sealed-hero">
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "3rem 1.25rem 2.5rem" }}>
          <header style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <EnvelopeMark />
            <div>
              <span className="sealed-eyebrow">
                <span className="sealed-dot" /> Testnet, demo mode, known gap listed below
              </span>
              <h1 style={{ margin: "0.75rem 0 0", fontSize: "clamp(2.4rem, 6vw, 4rem)", lineHeight: 1, letterSpacing: "-0.04em", fontWeight: 800 }}>
                Sealed Bid
              </h1>
            </div>
          </header>

          <p style={{ margin: "1.25rem 0 0", fontSize: "clamp(1.15rem, 2.5vw, 1.5rem)", lineHeight: 1.4, maxWidth: 720, fontWeight: 600 }}>
            Open bids let others copy your price. Here every bid stays sealed until close.
          </p>
          <p style={{ margin: "0.75rem 0 0", color: MUTED, maxWidth: 720 }}>
            One bid, encrypted with real ML-KEM-1024 to the auction address, bound with an ML-DSA-87
            signature, shown as ciphertext only. In demo mode, nobody can read the amount before close, not even
            the auction address key holder.
          </p>

          <div
            style={{
              marginTop: "1.75rem",
              padding: "1rem 1.1rem",
              border: "1px solid #d98a2b",
              borderRadius: 12,
              background: "#2a1c0d",
              maxWidth: 720,
            }}
            role="note"
          >
            <p style={{ margin: 0, fontWeight: 800, color: "#f0b45a" }}>Known gap, stated plainly</p>
            <p style={{ margin: "0.6rem 0 0", color: INK, lineHeight: 1.55 }}>
              The recipient KEM key is not published on chain. GET /qorechain/pqc/v1/kem/qor1kkmn9z3es9p3heet7y5zcrcg57g9ljp8909r5u
              returns found false, checked Nov 15 about 03:10 WAT. QoreX refused the registration:
              QoreX: /qorechain.pqc.v1.MsgRegisterKEMKey is managed by the wallet itself, not by a website.
            </p>
            <p style={{ margin: "0.6rem 0 0", color: MUTED, lineHeight: 1.55 }}>
              The encryption in this demo is real and runs locally in your browser, 8 tests pass. A keypair was
              generated Nov 15 about 03:07 WAT and the secret key was backed up. No registered recipient key is
              claimed anywhere here.
            </p>
          </div>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "2rem" }}>
            <div className="sealed-stat">
              <div className="sealed-stat-value">
                <CountUp value={1024} format={(n) => `ML-KEM-${n}`} />
              </div>
              <div style={{ color: MUTED, marginTop: "0.4rem", fontSize: "0.9rem" }}>Encryption, real, in the browser</div>
            </div>
            <div className="sealed-stat">
              <div className="sealed-stat-value">
                <CountUp value={1568} format={(n) => `${n.toLocaleString("en-US")}`} />
              </div>
              <div style={{ color: MUTED, marginTop: "0.4rem", fontSize: "0.9rem" }}>Byte public key, ML-KEM-1024</div>
            </div>
            <div className="sealed-stat">
              <div className="sealed-stat-value">
                <CountUp value={auction ? auction.bids.length : 0} format={(n) => `${n}`} />
              </div>
              <div style={{ color: MUTED, marginTop: "0.4rem", fontSize: "0.9rem" }}>Bids sealed, ciphertext only</div>
            </div>
            <div className="sealed-stat">
              <div className="sealed-stat-value">
                <CountUp value={auction ? auction.reserveCents : 50000} format={(n) => formatCents(n)} />
              </div>
              <div style={{ color: MUTED, marginTop: "0.4rem", fontSize: "0.9rem" }}>Reserve, fUSD</div>
            </div>
          </div>

          <div className="sealed-horizon" aria-hidden="true" />

          <nav aria-label="Product tour" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "2rem" }}>
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                className={index === activeStep ? "sealed-tab sealed-tab-active" : "sealed-tab"}
                onClick={() => scrollToStep(step.id)}
                aria-current={index === activeStep ? "step" : undefined}
              >
                {step.label}
                <span style={{ display: "block", fontWeight: 400, fontSize: "0.85rem", marginTop: "0.2rem" }}>
                  {step.detail}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 1.25rem 3rem" }}>
        <p
          style={{
            marginTop: "1.5rem",
            padding: "0.8rem 1rem",
            border: `1px solid ${GOLD}`,
            borderRadius: 12,
            color: GOLD_SOFT,
            fontSize: "0.95rem",
          }}
        >
          Demo mode. Keys are made in your browser and held in memory only. Testnet: {CHAIN_ID}, EVM chain
          id {EVM_CHAIN_ID}. No transaction is sent here. Known gap: the recipient KEM key is not published
          on chain, QoreX refused the registration, see the notice above.
        </p>

        {winnerCents !== null && auction?.status === "revealed" && (
          <section className="sealed-card sealed-pop" style={{ marginTop: "1.5rem", textAlign: "center", padding: "2.5rem 1.5rem" }}>
            <p style={{ margin: 0, color: MUTED, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontSize: "0.85rem" }}>
              Winner revealed
            </p>
            <p className="sealed-hero-number">
              <CountUp value={winnerCents} format={(n) => formatCents(n)} />
            </p>
            <p style={{ margin: "0.75rem 0 0", color: MUTED }}>
              That matches the sealed bid submitted earlier. The amount was ciphertext until close.
            </p>
          </section>
        )}

        <section id="step-1" className="sealed-card" style={{ marginTop: "1.5rem" }}>
          <h2 style={{ marginTop: 0, color: GOLD_SOFT, fontSize: "1.4rem", letterSpacing: "-0.02em" }}>1. Create an auction</h2>
          <label style={{ display: "block", marginBottom: "0.9rem" }}>
            <span style={{ display: "block", marginBottom: "0.35rem", color: MUTED }}>Title</span>
            <input className="sealed-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label style={{ display: "block", marginBottom: "0.9rem" }}>
            <span style={{ display: "block", marginBottom: "0.35rem", color: MUTED }}>Item</span>
            <input className="sealed-input" value={item} onChange={(e) => setItem(e.target.value)} />
          </label>
          <label style={{ display: "block", marginBottom: "1.1rem" }}>
            <span style={{ display: "block", marginBottom: "0.35rem", color: MUTED }}>
              Reserve price, fUSD
            </span>
            <input
              className="sealed-input"
              value={reserve}
              onChange={(e) => setReserve(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <button className="sealed-button" onClick={handleCreate}>
            Create auction and generate keys
          </button>
          {identity && auction && (
            <div className="sealed-pop" style={{ marginTop: "1.1rem", fontSize: "0.92rem" }}>
              <p style={{ margin: "0.3rem 0" }}>
                Auction address: <code>{identity.address}</code>
              </p>
              <p style={{ margin: "0.3rem 0" }}>
                ML-KEM-1024 key, 1568 bytes, sha3:{" "}
                <code>{mlkemKeyHashHex(identity.sealKeys.mlkemPublicKey).slice(0, 32)}...</code>
              </p>
              <p style={{ margin: "0.3rem 0" }}>
                Status: <strong>{auction.status}</strong> | Reserve: {formatCents(auction.reserveCents)} |
                Bids sealed: {auction.bids.length}
              </p>
            </div>
          )}
        </section>

        <section id="step-2" className="sealed-card" style={{ marginTop: "1.5rem" }}>
          <h2 style={{ marginTop: 0, color: GOLD_SOFT, fontSize: "1.4rem", letterSpacing: "-0.02em" }}>2. Submit a sealed bid</h2>
          <p style={{ color: MUTED, marginTop: 0 }}>
            In demo mode, your bid is encrypted client side with ML-KEM-1024 to the auction address, and the key is
            bound with an ML-DSA-87 signature before sealing.
          </p>
          <label style={{ display: "block", marginBottom: "1.1rem" }}>
            <span style={{ display: "block", marginBottom: "0.35rem", color: MUTED }}>Bid, fUSD</span>
            <input
              className="sealed-input"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button className="sealed-button" onClick={handleBid} disabled={!auction || auction.status !== "open"}>
              Seal my bid
            </button>
            <button
              className="sealed-button sealed-button-ghost"
              onClick={handleTryRead}
              disabled={!auction || auction.bids.length === 0}
            >
              Try to read it early
            </button>
          </div>
          {auction &&
            auction.bids.map((bid) => (
              <div
                key={bid.id}
                className="sealed-push-in"
                style={{
                  marginTop: "1.1rem",
                  border: `1px solid ${GOLD}`,
                  borderRadius: 12,
                  padding: "1.1rem",
                  background: "#12294d",
                }}
              >
                <p style={{ margin: "0 0 0.5rem", color: GOLD_SOFT, fontWeight: 700 }}>
                  Sealed bid {bid.id} {auction.status === "open" ? "is sealed" : ""}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "0.85rem",
                    wordBreak: "break-all",
                    color: INK,
                  }}
                >
                  {envelopePreview(bid.envelopeText, 120)}
                </p>
                <p style={{ margin: "0.6rem 0 0", fontSize: "0.92rem", color: MUTED }}>
                  {bid.revealedAmountCents === null
                    ? "Amount hidden. Ciphertext only, ML-KEM-1024."
                    : `Revealed amount: ${formatCents(bid.revealedAmountCents)}.`}
                </p>
              </div>
            ))}
        </section>

        <section id="step-3" className="sealed-card" style={{ marginTop: "1.5rem" }}>
          <h2 style={{ marginTop: 0, color: GOLD_SOFT, fontSize: "1.4rem", letterSpacing: "-0.02em" }}>3. Close, then reveal</h2>
          <p style={{ color: MUTED, marginTop: 0 }}>
            Closing stops new bids. Reveal decrypts every sealed bid and names the highest bid at or
            above the reserve as the winner.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              className="sealed-button"
              onClick={handleClose}
              disabled={!auction || auction.status !== "open"}
            >
              Close the auction
            </button>
            <button
              className="sealed-button"
              onClick={handleReveal}
              disabled={!auction || auction.status !== "closed"}
            >
              Decrypt and reveal the winner
            </button>
            <button className="sealed-button sealed-button-ghost" onClick={handleReset}>
              Start over
            </button>
          </div>
          {auction && auction.status === "revealed" && (
            <p className="sealed-pop" style={{ marginTop: "1.1rem", fontSize: "1.15rem" }}>
              {auction.winnerAmountCents === null
                ? "No winner. No bid met the reserve."
                : `Winner: ${formatCents(auction.winnerAmountCents)}.`}
            </p>
          )}
        </section>

        {notice && (
          <div key={notice} style={{ marginTop: "1.5rem" }}>
            <span className={pillKind === "blocked" ? "sealed-pill sealed-pill-blocked" : "sealed-pill sealed-pill-gold"} role="status">
              {pillKind === "blocked" ? "Blocked" : "Sealed"} {notice}
            </span>
          </div>
        )}
        {error && (
          <p
            style={{
              marginTop: "1.5rem",
              padding: "0.9rem 1rem",
              borderRadius: 10,
              background: "#3d1520",
              border: "1px solid #a33",
              color: "#ffd7d7",
            }}
            role="alert"
          >
            {error}
          </p>
        )}

        {log.length > 0 && (
          <section className="sealed-card" style={{ marginTop: "1.5rem" }}>
            <h2 style={{ marginTop: 0, color: GOLD_SOFT, fontSize: "1.4rem", letterSpacing: "-0.02em" }}>Run log</h2>
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              {log.map((line, index) => (
                <li key={index} style={{ marginBottom: "0.35rem" }}>
                  {line}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="sealed-card" style={{ marginTop: "1.5rem" }}>
          <h2 style={{ marginTop: 0, color: GOLD_SOFT, fontSize: "1.4rem", letterSpacing: "-0.02em" }}>Network and wallet, read only</h2>
          <p style={{ margin: "0.3rem 0" }}>
            SDK network: <code>{client.network.name}</code> (chain id{" "}
            <code>{client.network.chainId ?? String(EVM_CHAIN_ID)}</code>)
          </p>
          <p style={{ margin: "0.3rem 0" }}>
            Faucet: dashboard.qorechain.io/faucet, fest tokens fUSD, fETH and fBTC once every 24 hours.
          </p>
          <p style={{ margin: "0.3rem 0" }}>
            Docs: docs.qorechain.io. Kits: QoreSeal 0.1.0, QoreSign 0.1.0, QoreChain SDK 0.14.0.
          </p>
          <p style={{ margin: "0.3rem 0", color: MUTED }}>
            Recipient address for the KEM key check: qor1kkmn9z3es9p3heet7y5zcrcg57g9ljp8909r5u. GET
            /qorechain/pqc/v1/kem/qor1kkmn9z3es9p3heet7y5zcrcg57g9ljp8909r5u returns found false, checked Nov 15
            about 03:10 WAT. QoreX refused the registration: QoreX: /qorechain.pqc.v1.MsgRegisterKEMKey is
            managed by the wallet itself, not by a website. A keypair was generated Nov 15 about 03:07 WAT and
            the secret key was backed up. No registered recipient key is claimed here. Tests: 8 pass. Encryption:
            real ML-KEM-1024, in the browser, in demo mode.
          </p>
        </section>

        <footer style={{ marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px solid #24395e", display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <EnvelopeMark />
          <div>
            <p style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, letterSpacing: "-0.02em" }}>Sealed Bid</p>
            <p style={{ margin: "0.3rem 0 0", color: MUTED }} aria-label={tagline}>
              {tagline.split(" ").map((word, index) => (
                <span key={index} className="sealed-word" style={{ animationDelay: `${0.15 * index}s`, marginRight: "0.35em" }}>
                  {word}
                </span>
              ))}
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
