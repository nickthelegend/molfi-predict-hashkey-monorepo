#!/usr/bin/env bash
# One-command deploy of the full Molfi stack to HashKey Chain MAINNET (chain 177).
#
# Prereq: the deployer (see .env PRIVATE_KEY → 0x21e5EAc64fdFb84c1D7b94889d7A1555cA6d114d)
# must hold a little HSK on mainnet for gas (~2-3 HSK covers all 11 contracts).
# Check with:  cast balance <addr> --rpc-url https://mainnet.hsk.xyz
#
# Writes deployments/177.json. Then run the on-chain ZK lifecycle against mainnet:
#   node scripts/zk_lifecycle.mjs mainnet
set -euo pipefail
cd "$(dirname "$0")"
set -a; source .env; set +a

ADDR=$(cast wallet address --private-key "$PRIVATE_KEY")
BAL=$(cast balance "$ADDR" --rpc-url https://mainnet.hsk.xyz)
echo "Deployer: $ADDR"
echo "Mainnet HSK balance (wei): $BAL"
if [ "$BAL" = "0" ]; then
  echo "ERROR: deployer has 0 HSK on mainnet. Fund $ADDR on HashKey mainnet, then re-run." >&2
  exit 1
fi

forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://mainnet.hsk.xyz \
  --broadcast --slow

echo
echo "Deployed to HashKey mainnet. Addresses → deployments/177.json"
echo "Next: node scripts/zk_lifecycle.mjs mainnet   # prove all 3 ZK flows on mainnet"
