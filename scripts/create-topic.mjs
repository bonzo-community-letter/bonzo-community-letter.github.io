#!/usr/bin/env node
/**
 * Create the HCS topic that collects signatures.
 *
 * The topic has to be paid for by an account, and that account's key is yours.
 * So this script runs on your machine, reads the key from the environment or a
 * file — never from an argument, so it stays out of shell history — and never
 * prints it.
 *
 *   HEDERA_ACCOUNT_ID=0.0.1234 HEDERA_PRIVATE_KEY=302e... \
 *     node scripts/create-topic.mjs
 *
 *   HEDERA_ACCOUNT_ID=0.0.1234 \
 *     node scripts/create-topic.mjs --key-file ~/.hedera-open-letter.key
 *
 * Flags:
 *   --network mainnet|testnet   default: mainnet
 *   --memo "..."                default: <subject>:v<version>
 *   --key-file <path>           read the key from a file instead of the env
 *   --yes                       do not ask for confirmation
 *
 * The topic is created with **no admin key and no submit key**: anyone can write
 * to it, nobody can censor, edit or delete what is in it. That is the same shape
 * Bonzo used for the recovery portal's terms topic.
 */
import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { AccountBalanceQuery, Client, Hbar, PrivateKey, TopicCreateTransaction } from '@hiero-ledger/sdk'

const SUBJECT = 'bonzo-exploit-open-letter'
const PAYLOAD_VERSION = 1

function parseArgs(argv) {
  const args = { network: 'mainnet', memo: `${SUBJECT}:v${PAYLOAD_VERSION}`, yes: false, keyFile: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--yes' || arg === '-y') args.yes = true
    else if (arg === '--network') args.network = argv[++i]
    else if (arg === '--memo') args.memo = argv[++i]
    else if (arg === '--key-file') args.keyFile = argv[++i]
    else if (arg === '--help' || arg === '-h') args.help = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return args
}

function usage() {
  return `Create the open-letter HCS topic.

  HEDERA_ACCOUNT_ID=0.0.x [HEDERA_PRIVATE_KEY=...] node scripts/create-topic.mjs [flags]

  --network mainnet|testnet   where to create it (default: mainnet)
  --memo "..."                topic memo (default: ${SUBJECT}:v${PAYLOAD_VERSION})
  --key-file <path>           read the private key from a file instead of the env
  --yes                       skip the confirmation prompt

The key is read from HEDERA_PRIVATE_KEY or --key-file and is never printed.`
}

const args = (() => {
  try {
    return parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`✗ ${error.message}\n\n${usage()}`)
    process.exit(2)
  }
})()

if (args.help) {
  console.log(usage())
  process.exit(0)
}

const accountId = process.env.HEDERA_ACCOUNT_ID?.trim()
const keyText = args.keyFile
  ? (await readFile(args.keyFile, 'utf8')).trim()
  : process.env.HEDERA_PRIVATE_KEY?.trim()

if (!accountId || !keyText) {
  console.error(`✗ HEDERA_ACCOUNT_ID and a key are required.\n\n${usage()}`)
  process.exit(2)
}
if (!['mainnet', 'testnet'].includes(args.network)) {
  console.error(`✗ --network must be mainnet or testnet, got "${args.network}"`)
  process.exit(2)
}

let key
try {
  key = PrivateKey.fromString(keyText)
} catch {
  console.error('✗ The private key could not be parsed. Pass the DER string or a raw hex key.')
  process.exit(2)
}

const client = Client.forName(args.network).setOperator(accountId, key)
// A topic costs about a hundredth of an HBAR; a ceiling keeps a misconfiguration
// from turning into a surprise bill.
client.setDefaultMaxTransactionFee(new Hbar(5))

const finish = (code) => {
  client.close()
  process.exit(code)
}

try {
  const balance = await new AccountBalanceQuery().setAccountId(accountId).execute(client)
  console.log(`network      ${args.network}`)
  console.log(`payer        ${accountId}  (${balance.hbars.toString()})`)
  console.log(`memo         ${args.memo}`)
  console.log('keys         admin: none, submit: none — open topic')
} catch (error) {
  console.error(`✗ Cannot read the account: ${error.message}`)
  finish(1)
}

if (!args.yes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`\nCreate this topic on ${args.network}? [y/N] `)
  rl.close()
  if (!/^y(es)?$/i.test(answer.trim())) {
    console.log('Cancelled — nothing was created.')
    finish(0)
  }
}

try {
  const transaction = new TopicCreateTransaction().setTopicMemo(args.memo)
  const response = await transaction.execute(client)
  const receipt = await response.getReceipt(client)
  const topicId = receipt.topicId?.toString()

  if (!topicId) {
    console.error('✗ The receipt has no topic id — check the transaction on HashScan.')
    finish(1)
  }

  console.log(`\n✓ topic ${topicId}`)
  console.log(`  https://hashscan.io/${args.network}/topic/${topicId}`)
  console.log(`  transaction ${response.transactionId.toString()}`)
  console.log(`\nNext: set the repository variable VITE_HCS_TOPIC_ID_${args.network.toUpperCase()}=${topicId}`)
  console.log('      and VITE_HEDERA_NETWORK=' + args.network)
  finish(0)
} catch (error) {
  console.error(`✗ ${error.message}`)
  finish(1)
}
