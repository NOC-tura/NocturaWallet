# Noctura Wallet

Privacy-first mobile wallet for Solana with shielded transactions, zero-knowledge proofs, and multi-chain support.

## Features

- **Shielded Transactions** — ZK-proof powered private transfers
- **Multi-Chain** — Solana native + EVM bridging
- **Staking** — Built-in SOL staking with validator selection
- **Hardware Wallet** — Ledger integration via BLE
- **Biometric Auth** — FaceID / TouchID / PIN
- **Geo-Compliance** — OFAC & jurisdiction-aware restrictions

## Tech Stack

- React Native 0.84.1 (New Architecture / Fabric / Hermes)
- @solana/web3.js >= 1.95.8 (v1.x — migrate to @solana/kit when Anchor supports it)
- Groth16/BN254 ZK proofs via @callstack/polygen AOT + hosted prover
- BLST (Supranational) for native BLS12-381 signing
- Zustand + MMKV + NativeWind v4

## License

This project is licensed under the [Business Source License 1.1](LICENSE).

**Change Date:** 2034-01-01  
**Change License:** MIT

See [LICENSE](LICENSE) for full terms.

## Security

For responsible disclosure, see [SECURITY.md](SECURITY.md).

## Contact

- licensing@noctura.io
