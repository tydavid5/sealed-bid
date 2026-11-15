# Sealed Bid, demo video storyboard

Five beats, about 3 seconds each, one claim per beat, problem first. True screencast of the live demo, demo mode labelled on screen. No faked results, no recorded video yet.

## Beat 1, 0 to 3 seconds, the problem

Screen: the Sealed Bid home page, deep navy with soft gold, sealed envelope mark.
Claim on screen: "Open bids let others copy your price."
Action: hold on the title and the problem line. No clicking yet.

## Beat 2, 3 to 6 seconds, the seal

Screen: create the auction, then type a bid of 1250 fUSD and press "Seal my bid".
Claim on screen: "Sealed with ML-KEM-1024. Ciphertext only."
Action: the sealed card appears showing the `qoreseal:` envelope text. The amount is nowhere on screen in plain text.

## Beat 3, 6 to 9 seconds, the blocked read

Screen: press "Try to read it early".
Claim on screen: "A bid cannot be read before close."
Action: the app shows "Blocked, as designed" and the run log records the blocked attempt. The bid stays ciphertext.

## Beat 4, 9 to 12 seconds, close and reveal

Screen: press "Close the auction", then "Decrypt and reveal the winner".
Claim on screen: "Close, decrypt, winner revealed."
Action: the revealed amount appears, $1250.00, matching the bid sealed in beat 2.

## Beat 5, 12 to 15 seconds, the proof and the label

Screen: the run log and the network panel, demo mode banner visible.
Claim on screen: "Demo mode. Live step waits for faucet funds and ML-DSA-87 key registration for Five QoreX address qor1kkmn9z3es9p3heet7y5zcrcg57g9ljp8909r5u."
Action: hold on the log lines showing the ML-KEM-1024 key, the verified ML-DSA-87 binding, and the reveal. End card: Sealed Bid, QoreChain testnet.

## Notes for the recording

- Record the real app at https://sealed-bid-iota.vercel.app, in one take, no cuts inside a beat.
- Keep the demo mode banner in frame for the whole video.
- Do not type a real wallet address or show a real seed. Demo keys are made in the browser and never shown.
- Do not record or upload any video until Five approves this storyboard.
