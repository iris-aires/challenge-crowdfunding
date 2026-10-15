# Crowdfund

An Ethereum crowdfunding application built with Next.js, Scaffold-ETH 2, and Foundry. Contributors fund a campaign through a public smart contract. When its deadline passes, a successful campaign forwards funds to its recipient; otherwise contributors can withdraw their contributions.

## Requirements

- Node.js 20.18.3 or later
- Yarn 4.13.0 (via Corepack)
- Foundry

## Local development

```bash
yarn install
```

Run each command in a separate terminal:

```bash
yarn chain
yarn deploy
yarn start
```

Open http://localhost:3000. The overview and campaign pages show contract balances, the funding target, the deadline, and contribution controls. The contributions page lists onchain contribution events. Contract tools and a local block explorer are available for development.

## Validation

```bash
yarn next:check-types
yarn next:lint
yarn test
```

## Project structure

- `packages/foundry/contracts`: crowdfunding and recipient smart contracts
- `packages/foundry/script`: deployment scripts
- `packages/foundry/test`: contract tests
- `packages/nextjs/app`: application pages
- `packages/nextjs/components`: navigation and shared wallet components
- `packages/nextjs/styles/globals.css`: theme and layout

Redeploy with `yarn deploy --reset` to reset the local campaign deadline. Set your target network in `packages/nextjs/scaffold.config.ts` before deploying to a testnet.
