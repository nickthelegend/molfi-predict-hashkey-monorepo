pragma circom 2.0.0;

// Minimal circuit used to validate the BN254 Groth16 byte-encoding pipeline
// (snarkjs proof/vkey -> EVM verifier). Proves knowledge of a, b with a*b == c.
template Mul() {
    signal input domain; // public — binds market/action/nonce
    signal input c;       // public — the product
    signal input a;       // private factor
    signal input b;       // private factor

    a * b === c;

    // Fold `domain` into the witness so the proof can't be replayed elsewhere.
    signal d;
    d <== domain * domain;
}

// Public-signal order MUST be [domain, ...rest] to match on-chain verifier, which
// treats the first public signal as the domain tag.
component main {public [domain, c]} = Mul();
