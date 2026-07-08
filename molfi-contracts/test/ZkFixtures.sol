// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Real Groth16 BN254 proof calldata exported by snarkjs, hardcoded from
///         ../molfi-circuits/build_evm/<circuit>/{calldata.txt,public.json}.
///         Inherit this in tests to reuse the a/b/c/pubSignals fixtures.
abstract contract ZkFixtures {
    // ── solvency: pub = [domain=424242, threshold=100000000] ──────────────────
    function solvencyProof()
        internal
        pure
        returns (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[2] memory pub)
    {
        a = [
            0x00ebbb76dda656cf37abffddbb7dcd8fbf471ccd433d8a7d989e758b8c835611,
            0x27f8cdb13225d82ccf18961d6c2aa79084ae28e075508b7d095cdcc46585e33b
        ];
        b = [
            [
                0x2a3cb57b532d1e748c261c8e048fd00dd90313be5abecf11af928900a45af239,
                0x26d6b2e8003882d3dce4ca6c310320d60e72feea2d19ac227e5c760d998493c2
            ],
            [
                0x12ebcba9ad8ce3edee0b6570b0e8c7ce5b6ab75393b59b14c23b74f026676979,
                0x1b203fe1f0200b8a313a0ea3c00e3dbb09b48866700e92feb85a72c0ab27a283
            ]
        ];
        c = [
            0x3006f4369d613e65ee94e25f1422777bc05ced8896af5d46cce521d91cdf5272,
            0x25281e392519107d59dbbb7c48edd05fab5465a9416a63df82ae308b8d2de500
        ];
        pub = [uint256(424242), uint256(100000000)];
    }

    // ── mul: pub = [7, 15] ────────────────────────────────────────────────────
    function mulProof()
        internal
        pure
        returns (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[2] memory pub)
    {
        a = [
            0x0bb30df64e7f3a0c0a79d45c60448bb761c452a1b0447c8914b604a4d5eb1b6b,
            0x1dd3664008c2d8a54bfafebacd0a99bce1e250d7596ecf158a6b9a8241b8b5c9
        ];
        b = [
            [
                0x02216e1d918f318ac464a5d63e050de56078c3d1fa50c2f56492bab3d339bc87,
                0x127945ae116c20ce3952c801ca4961a30a409e43c8ea4b193bee9479512df2f7
            ],
            [
                0x2854029786e21733d7622e4897ecfb1ab7881772dc1e5609262d73c5bc86192a,
                0x1b02ddfecf0db2c0ec27b80a37dacd5a1dee3fc5e94ba0aedd73c66ae4560626
            ]
        ];
        c = [
            0x1a78deae8ede1d5193c5fbb02459a3707ef3a488deb60529d4ec2624d43c73d4,
            0x013b85598fb1ee4186faa877e5df4186dd211c40be85a558f1a9d6497ca492f6
        ];
        pub = [uint256(7), uint256(15)];
    }

    // ── confidential_bet: pub = [root, nullifierHash, outcome=0, recipient] ────
    uint256 internal constant CB_ROOT =
        11323959007800747051345298391989773091321271562071727349068255722042326386451;
    uint256 internal constant CB_NULLIFIER =
        21484669546358335811058320782594337224184293469722637179181513335025929373146;
    uint256 internal constant CB_OUTCOME = 0;
    uint256 internal constant CB_RECIPIENT = 987654321987654321;

    function confidentialBetProof()
        internal
        pure
        returns (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[4] memory pub)
    {
        a = [
            0x147b90166fe1f94b0ff4c733bd1f2393a803f00770bd3c84c3ce6d6277429290,
            0x171f42cf7378d84f6c6f6a469a49308a0a490e0bdfa1261b41827ad748a9bd1c
        ];
        b = [
            [
                0x08e881cd8d7f13cad64a487f0bf1b5eca5dc223f1e03d844f98efb384fed03a2,
                0x29234aca9021e6e7c4fab72e8f76152415d1f1e2d1cdf04fde48df50b28e3271
            ],
            [
                0x128f0fe59b402a7cf2e241b4adba4e4edb5932abd32f12308cd56b993d426672,
                0x267a7632253f526c3e3e88927c726938ddc2487a65e0115ae90de217fe869906
            ]
        ];
        c = [
            0x2c11fc7b026924945e0d7b1dc2431049f2b5afb770c32a8c508061bec0b493a7,
            0x0a1ed89c6b6381c28d7e8202353b085627eb362e37f9c5b7dcdc9c36b797cebb
        ];
        pub = [CB_ROOT, CB_NULLIFIER, CB_OUTCOME, CB_RECIPIENT];
    }

    // ── withdraw: pub = [root, nullifierHash, recipient, amount=100000000] ─────
    uint256 internal constant W_ROOT =
        6108594498975687740885024672257059076538592663076466893636290762413144620422;
    uint256 internal constant W_NULLIFIER =
        17083429929392062867839005744906864647025095101488406155741088046265191846574;
    uint256 internal constant W_RECIPIENT = 1075822357067;
    uint256 internal constant W_AMOUNT = 100000000;

    function withdrawProof()
        internal
        pure
        returns (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[4] memory pub)
    {
        a = [
            0x2ff3579250de2ab7752904a6c6071ca23463cd7007d6c76982be4342c5a248b7,
            0x011bb9b651c1254c59d1d459675b4bc32161339f8afc97cc7de395844025c47f
        ];
        b = [
            [
                0x28d49f3380b11e6dbf540ed037dedea80e7b53669ad7ae04b22c76b0f1985db9,
                0x13818fa9c091f044caa108396864313ec4651de6db5fd78d662524a0387b5931
            ],
            [
                0x1818b60bf5817bdc777556cd6cd58146f75585c81d0a1ee9c0d3e04dd5d15d90,
                0x0a6be8065e402b15f2c2f971fe1050f7d3fb25d0fb1f01fc61241453d3dabc98
            ]
        ];
        c = [
            0x2545cccd7784d729fd0248fce43701373c8d27609dec06c2b62fdf4902e72f36,
            0x2ac1e5257a9a2c34c84a4dc267b43c08fa9f33240ace4e8659150741d995b700
        ];
        pub = [W_ROOT, W_NULLIFIER, W_RECIPIENT, W_AMOUNT];
    }
}
