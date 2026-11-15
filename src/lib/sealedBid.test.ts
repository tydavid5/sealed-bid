import { describe, expect, it } from "vitest";

import {
  ML_KEM_PUBLIC_KEY_LENGTH,
  createAuction,
  createDemoIdentity,
  closeAuction,
  envelopePreview,
  formatCents,
  mlkemKeyHashHex,
  openBidAmount,
  publicIdentityOf,
  readBid,
  revealBids,
  sealBidAmount,
  signBinding,
  submitBid,
  verifyBinding,
} from "./sealedBid";

describe("ML-KEM-1024 sealed bids", () => {
  it("encrypt then decrypt returns the original bid", () => {
    const identity = createDemoIdentity();
    const auction = createAuction("Harvest Lot 7", "One tonne of dried hibiscus", 50000);
    const amountCents = 125000;
    const envelopeText = sealBidAmount(identity, auction.id, amountCents);
    expect(envelopeText.startsWith("qoreseal:")).toBe(true);
    expect(envelopeText).not.toContain(String(amountCents));
    expect(envelopeText).not.toContain("1250");
    const bid = openBidAmount(identity, envelopeText, auction.id);
    expect(bid.amountCents).toBe(amountCents);
    expect(bid.auctionId).toBe(auction.id);
    expect(bid.currency).toBe("fUSD");
    expect(bid.bidder).toBe(identity.address);
  });

  it("a different recipient key cannot decrypt the bid", () => {
    const identity = createDemoIdentity();
    const stranger = createDemoIdentity();
    const auction = createAuction("Harvest Lot 7", "One tonne of dried hibiscus", 50000);
    const envelopeText = sealBidAmount(identity, auction.id, 125000);
    expect(() => openBidAmount(stranger, envelopeText, auction.id)).toThrow();
  });

  it("the ML-KEM key is 1568 bytes and hashes to a stable id", () => {
    const identity = createDemoIdentity();
    expect(identity.sealKeys.mlkemPublicKey.length).toBe(ML_KEM_PUBLIC_KEY_LENGTH);
    expect(identity.sealKeys.mlkemPublicKey.length).toBe(1568);
    const first = mlkemKeyHashHex(identity.sealKeys.mlkemPublicKey);
    const second = mlkemKeyHashHex(identity.sealKeys.mlkemPublicKey);
    expect(first).toBe(second);
    expect(first.length).toBe(64);
  });

  it("ML-DSA-87 key binding verifies, and a tampered binding fails", () => {
    const identity = createDemoIdentity();
    const auction = createAuction("Harvest Lot 7", "One tonne of dried hibiscus", 50000);
    const { text, signature } = signBinding(identity, auction.id);
    expect(() => verifyBinding(publicIdentityOf(identity), auction.id, text, signature)).not.toThrow();
    const tampered = text.replace("Harvest", "Harvesx");
    const tamperedText = tampered === text ? `${text} ` : tampered;
    expect(() => verifyBinding(publicIdentityOf(identity), auction.id, tamperedText, signature)).toThrow();
    const stranger = createDemoIdentity();
    expect(() => verifyBinding(publicIdentityOf(stranger), auction.id, text, signature)).toThrow();
  });

  it("a bid cannot be read before close in the app state", () => {
    const identity = createDemoIdentity();
    const auction = createAuction("Harvest Lot 7", "One tonne of dried hibiscus", 50000);
    const { auction: withBid, bid } = submitBid(auction, identity, 125000);
    expect(withBid.status).toBe("open");
    expect(withBid.bids[0].revealedAmountCents).toBeNull();
    expect(envelopePreview(bid.envelopeText)).not.toContain("1250");
    expect(() => readBid(withBid, bid.id, identity)).toThrow(/cannot be read before/i);
    expect(() => revealBids(withBid, identity)).toThrow(/only be revealed after/i);
    const closed = closeAuction(withBid);
    expect(closed.status).toBe("closed");
    expect(closed.bids[0].revealedAmountCents).toBeNull();
  });

  it("the winner reveal after close matches the submitted bid", () => {
    const identity = createDemoIdentity();
    const auction = createAuction("Harvest Lot 7", "One tonne of dried hibiscus", 50000);
    const first = submitBid(auction, identity, 125000);
    const second = submitBid(first.auction, identity, 98000);
    const closed = closeAuction(second.auction);
    const { auction: revealed, revealed: bids } = revealBids(closed, identity);
    expect(revealed.status).toBe("revealed");
    expect(bids.map((entry) => entry.amountCents).sort((a, b) => a - b)).toEqual([98000, 125000]);
    expect(revealed.winnerAmountCents).toBe(125000);
    expect(revealed.winnerBidId).toBe(first.bid.id);
    expect(revealed.bids.find((entry) => entry.id === first.bid.id)?.revealedAmountCents).toBe(125000);
    expect(formatCents(revealed.winnerAmountCents ?? 0)).toBe("$1250.00");
  });

  it("no winner when every bid is below the reserve", () => {
    const identity = createDemoIdentity();
    const auction = createAuction("Harvest Lot 7", "One tonne of dried hibiscus", 200000);
    const { auction: withBid } = submitBid(auction, identity, 125000);
    const closed = closeAuction(withBid);
    const { auction: revealed } = revealBids(closed, identity);
    expect(revealed.winnerBidId).toBeNull();
    expect(revealed.winnerAmountCents).toBeNull();
    expect(revealed.bids[0].revealedAmountCents).toBe(125000);
  });

  it("a sealed bid cannot be submitted after close", () => {
    const identity = createDemoIdentity();
    const auction = createAuction("Harvest Lot 7", "One tonne of dried hibiscus", 50000);
    const closed = closeAuction(auction);
    expect(() => submitBid(closed, identity, 125000)).toThrow(/not open/i);
  });
});
