#!/usr/bin/env bash
# Compile a circuit and run the full BN254 Groth16 pipeline for EVM:
#   compile -> (shared) powers-of-tau -> setup -> prove -> off-chain verify
#   -> export Solidity verifier -> export Solidity calldata.
# Usage: scripts/build_bn254.sh <circuit-name> [ptau_power]
set -euo pipefail
cd "$(dirname "$0")/.."

CIRCUIT="$1"
PTAU_POWER="${2:-14}"
CIRCOM="${CIRCOM:-circom}"
SNARKJS="npx --no-install snarkjs"
BUILD="build_evm/$CIRCUIT"
mkdir -p "$BUILD"

echo "== compile $CIRCUIT (BN254 / bn128) =="
"$CIRCOM" "circuits/$CIRCUIT.circom" --r1cs --wasm --sym \
  -l node_modules/circomlib/circuits -o "$BUILD"

if [ ! -f build_evm/pot_final.ptau ]; then
  echo "== powers of tau (bn128, power $PTAU_POWER, shared) =="
  $SNARKJS powersoftau new bn128 "$PTAU_POWER" build_evm/pot0.ptau -v
  $SNARKJS powersoftau contribute build_evm/pot0.ptau build_evm/pot1.ptau --name=molfi -v -e="molfi-hashkey-entropy-1"
  $SNARKJS powersoftau prepare phase2 build_evm/pot1.ptau build_evm/pot_final.ptau -v
fi

echo "== groth16 setup =="
$SNARKJS groth16 setup "$BUILD/$CIRCUIT.r1cs" build_evm/pot_final.ptau "$BUILD/0.zkey"
$SNARKJS zkey contribute "$BUILD/0.zkey" "$BUILD/final.zkey" --name=molfi -v -e="molfi-hashkey-entropy-2"
$SNARKJS zkey export verificationkey "$BUILD/final.zkey" "$BUILD/vkey.json"

echo "== witness + prove =="
node "$BUILD/${CIRCUIT}_js/generate_witness.js" \
  "$BUILD/${CIRCUIT}_js/$CIRCUIT.wasm" "inputs/$CIRCUIT.input.json" "$BUILD/witness.wtns"
$SNARKJS groth16 prove "$BUILD/final.zkey" "$BUILD/witness.wtns" "$BUILD/proof.json" "$BUILD/public.json"

echo "== off-chain verify (sanity) =="
$SNARKJS groth16 verify "$BUILD/vkey.json" "$BUILD/public.json" "$BUILD/proof.json"

echo "== export Solidity verifier =="
$SNARKJS zkey export solidityverifier "$BUILD/final.zkey" "$BUILD/verifier.sol"

echo "== export Solidity calldata =="
$SNARKJS zkey export soliditycalldata "$BUILD/public.json" "$BUILD/proof.json" > "$BUILD/calldata.txt" 2>/dev/null || \
  $SNARKJS zkey export soliditycalldata "$BUILD/proof.json" "$BUILD/public.json" > "$BUILD/calldata.txt"

echo "OK: $CIRCUIT  (public signals: $(cat "$BUILD/public.json" | tr -d '\n '))"
