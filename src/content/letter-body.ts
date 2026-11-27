/**
 * The letter itself.
 *
 * A light markup, because the sheet renders it: `##` and `###` for headings, `**bold**`,
 * `1.` and `-` for lists, `---` for a rule. Nothing else — the text is the letter, and the
 * only thing that may happen to it is being displayed.
 *
 * This is the string a signature commits to: `letter.ts` exports it as `letterText`, and the
 * build hashes it. Changing one character invalidates every signature that came before.
 */
export const LETTER_BODY = `This open letter was written, coordinated, and signed by users affected by the exploit on Bonzo Lend — Hedera's only lending and borrowing platform — caused by a severe security flaw in Supra Labs' oracle protocol: the attacker took over $9,061,019 directly, and a liquidation bot owner kept a further $905,035.[1][2] This letter is directed at the companies and institutions that are responsible for what led to the exploit, that publicly promised full recovery right after it, that endorsed those promises, and those that stayed silent.

Despite this criticism, we remain grateful for the **partial recovery** that happened thanks to four months of effort by the Bonzo Finance Labs team and we are aware that many DeFi exploits in the past resulted in no recovery for users at all. But we are also aware of DeFi exploits in which users were made whole — restoring trust and keeping the affected chain's DeFi infrastructure intact. With this campaign, we are asking for what was promised right after the exploit.

**This letter is about broken promises and destroyed trust on Hedera — the _trust layer of the digital economy_.[3]**

## What happened?

**Between 29 June and 3 July 2026**, Supra Labs patched a security flaw in its pull-oracle verifier on at least eleven blockchains. Hedera and Fuse were not among them. Supra published no advisory describing that rollout to its users, and the sequence was visible on-chain to any person or AI monitoring on-chain updates.[4] This uncoordinated security patching, stretched over the two weeks preceding the exploit, was technically equivalent to announcing on-chain — to any bad actor — that an unpatched bug existed on Supra Labs' Hedera oracle.[4]

**On 11 July 2026**, that security flaw in Supra Labs' pull-oracle verifier let an attacker write a fabricated price for a single token pair, **SAUCE/wHBAR (pair 425)**.[5] Every protocol reading that feed received the fabricated price. Bonzo Lend was one of those protocols and **blindly trusted** the price feed. Based on this, Bonzo Lend valued the attacker's supplied 250 SAUCE — a few dollars of real collateral — far above its real worth. This allowed the attacker to "borrow" 6,634,528.202695 USDC and 34,518,389.36109841 HBAR, worth **$9,061,019.76** against this fake collateral. At the same time, the fabricated SAUCE price caused 52 LiquidationCall events causing an additional $905,035 worth of assets to be drained form the pool via a liquidation bot, whose owner never returned the unlawfully liquidated assets. Furthermore, a vigilant user – Wallet B – borrowed $1,032,247 worth of assets to rescue them. He directly identified himself to the Bonzo Team and later returned the assets.[1][2]

**On 13 July 2026**, Supra's CEO Josh Tobkin offered the hacker $100,000, all charges dropped, and a guaranteed job if the assets were returned within 72 hours; if not, he announced a $100,000 bounty on the hacker's head, growing 10% a year on top of inflation – forever.[6] While probably offered in good intention, it resulted in a publicity stunt without effect.

**On 16 July 2026**, Bonzo published a commitment that affected users would receive "**advances covering the full value of the losses to their affected positions** [...] backed by a recovery facility committed by Hedera Foundation".[7] The announcement was endorsed by Hedera's official X account,[8] and Bonzo Finance Labs has since stated that the post was "edited and approved by the Hedera Foundation and Hedera representatives".[9]

**On 6 August 2026**, the white hat — "Wallet B" — returned 90% of the $1,032,262 in assets he had borrowed to protect user funds. Bonzo Finance Foundation and Bonzo Finance Labs granted a bounty, letting him keep 10% of the rescued assets.[10][11] That bounty was not paid by Bonzo, Supra or Hedera; it came out of the recovered pool, and therefore from the users' funds. The release he signed also waived his own claim on Bonzo Lend, reducing his net bounty to **8.1%** — below the 10% of returned funds that Bonzo had described as an industry standard.[10][11]

**On 12 November 2026**, the recovery portal opened. It nets each account's borrowing against its supplied assets at fixed 11 July prices and pays out in fixed token amounts, so every user carries whatever the market had moved to since.[2] After that netting, accounts that supplied only HBAR or USDC received **56.1%** of their net entitlement, while user with other assets recovered between 56.1% and 100%.[12] The Hedera Foundation's contribution was **795,431 USDC** — **42.8% of the $1,860,686.68 shortfall** borne by non-institutional users.[12][11] Bonzo indirectly contributed $70,260 by waiving their protocol revenue claims and – probably – absorbed most of the legal and operational costs of the recovery portal development (i.e., smart contract development, infrastructure operation, additional security audits, etc.).

**As a result of this recovery approach, 658 of the 2,466 eligible accounts (26.7%) were left short of their net entitlement, with a total of $1,065,256 still outstanding.[12] The damage is concentrated: Only 829 of the 2,466 accounts held $25 or more in pre-exploit net value; and 622 of the 829 accounts – that is, roughly 75% of the active users – are still short.[10] Half of these users only recovered 56.1% of their net entitlements. This is far away from the full value of their losses.**

## What do we ask for?

1. **Hedera Foundation** promised **_advances covering the full value of the losses_ to the affected positions of all users[7]** while the crypto press was watching. But it silently stepped away from that promise once the press moved on, leaving a shortfall of $1,065,255.68 for affected users.

   **We ask Hedera Foundation to keep its promise and to cover the full value of losses to all affected positions!**

2. **Supra Labs** and **Entropy Foundation** never took any public responsibility for user recovery. It was Supra Labs' technology, their uncoordinated security patch on multiple public chains, and the lack of a security patch on Hedera, that exposed Bonzo Lend to the exploit risk in the first place. Instead, Supra's founder, Joshua D. Tobkin, offered the hacker $100,000 and a job if they returned the stolen assets. A publicity stunt with no effect, while the crypto press was watching. But we — the affected users — never heard anything from Supra Labs or its CEO during the recovery phase again.

   **We ask Supra Labs and Entropy Foundation to take responsibility and to support user recovery. Don't offer money to a hacker who will never respond and is unlikely to get caught – donate the money to make users whole instead!**

3. **Bonzo Finance Labs** and **Bonzo Finance Foundation** promised a 10% bounty to Wallet B for returning the rescued assets. This user alone basically contributed more to the user recovery than the Hedera Foundation. In return he should have received an industry standard of 10% as a bounty. But since he had to quietly waive his recovery claims before receiving the bounty, he effectively received a 8.1% instead of a 10% bounty. And those 8.1% were fully paid from user assets without asking. Hedera, Supra, and Bonzo did not contribute a single HBAR to the white hat's deserved bounty.

   **We ask Hedera Foundation, Supra Labs, Bonzo Finance Foundation, and Bonzo Finance Labs to fulfill the 10% bounty promise – and don't use customer money to pay the missing 1.9%!**

4. **Hashgraph Foundry**, **Hedera Hashgraph**, and **Hedera Foundation** should support a relaunch of a security-hardened Bonzo v2 as the only lending and borrowing protocol on Hedera. If the trust of users is restored, many of us will return. Otherwise, many of us will leave the Hedera ecosystem forever.

   **We ask Hashgraph Foundry, Hedera Hashgraph, and Hedera Foundation to commit funding to, and to support a re-launch of a security-hardened Bonzo v2. You asked for a re-launch plan and we know the Bonzo team provided you with one – now act!**

## Where could the recovery funding come from?

We are sure that there are multiple funding sources; we only list two of them to show that the recipients of this letter have the funds to re-establish our trust by keeping the promise of a recovery:

1. From the up to 7,000,000,000 HBAR (~$492,065,000 at pre-exploit prices) that the Hedera Council's non-binding term sheet granted to Hedera Foundation for ecosystem development,[13] of which
   - the first 50% (3,500,000,000 HBAR) were released to the Hedera Foundation on 14 February 2025 and around 68% have not yet been spent;[13]
   - the second 50% (3,500,000,000 HBAR) were re-allocated to the Hedera Council's general Ecosystem & Open Source Development fund on 29 October 2025.[13]

2. From Supra Labs and Entropy Foundation, whose oracle technology and uncoordinated security patches[4] **publicly exposed** the Hedera ecosystem's lending protocol to the exploit risk, eventually leading to the exploit itself. The $100,000 offered to the hacker by CEO Joshua D. Tobkin could be re-allocated to the affected users as a minimum sign of support.

We — the holders of the 2,466 accounts that used Bonzo Lend — are, to a large part, Hedera's DeFi layer. We put our trust in the DeFi and oracle technology endorsed, advertised, and supported by Hedera Hashgraph and Hedera Foundation.

### Hedera claims to be the trust layer of the digital economy. Broken promises do not build trust. This is your final chance to do better. Keep your promises, keep us on Hedera!

---

### Sources

**1** — Bonzo Finance Labs, "Bonzo Lend Incident Report: Oracle Provider Exploit", 11 Jul 2026 — "00:51:47: Wallet A borrows 6,634,528.202695 USDC from Bonzo Lend. 00:51:57: Wallet A borrows 34,518,389.36109841 WHBAR from Bonzo Lend." The report states the headline impact as "approximately $9.05 million". https://bonzo.finance/blog/bonzo-lend-incident-report-oracle-provider-exploit

**2** — Bonzo Finance Labs, "Bonzo Recovery Update: Claims Mechanism and Opening Timeline", 30 Oct 2026 — inventory captured at block 101,581,825 (26 Oct 2026); **prices fixed to 11 Jul 2026 observations**; USDC = $1.00. Valuing the incident report's HBAR amount at the HBAR price fixed here gives 34,518,389.36109841 × $0.0702956 = $2,426,491.56, and $9,061,019.76 in total. https://bonzo.finance/blog/bonzo-recovery-update-claims-mechanism-and-opening-timeline

**3** — Hedera Foundation, "Ecosystem": "Hedera is the trust layer of the digital economy, delivering fast, secure, and energy-efficient distributed ledger technology (DLT) powered by its unique hashgraph consensus." https://hedera.foundation/ecosystem — the same sentence appears at https://hederacouncil.org/ecosystem

**4** — Tomachi Anura, "A signature made of zeros: reconstructing the Bonzo Lend / Supra verifier exploit on-chain", 14 Jul 2026, 12:30 UTC. https://x.com/TomachiAnura/article/2077007819912405116 — corroboration: BlockchainSecurity.rs, "Oracle attack on Bonzo Finance: patch existed for eight days, just not on Hedera", 22 Aug 2026, https://blockchainsecurity.rs/en/oracle-attack-on-bonzo-finance-patch-existed-for-eight-days-just-not-on-hedera/ ; Protos, "Supra patched oracle on 11 other chains before $9M Hedera exploit", 15 Jul 2026, https://protos.com/supra-patched-oracle-on-11-other-chains-before-9m-hedera-exploit/

**5** — Supra, "Security Incident Report: Hedera Pull-Oracle Verifier", 11 Jul 2026, 13:55 UTC. https://supra.com/news/security-incident-report-hedera-pull-oracle-verifier

**6** — Josh Tobkin (@JoshuaTobkin), Supra, on X, 13 Jul 2026, 11:32 UTC — offer of $100,000 to keep, charges dropped and a job within 72 hours; otherwise a $100,000 bounty growing 10% a year. https://x.com/JoshuaTobkin/status/2076630890017587515

**7** — Bonzo Finance Labs, "Hedera Foundation Issues Compensation for Bonzo Finance Impacted Users", 16 Jul 2026 — "advances covering the full value of the losses to their affected positions [...] backed by a recovery facility committed by Hedera Foundation". https://bonzo.finance/blog/hedera-foundation-issues-compensation-for-bonzo-finance-impacted-users

**8** — Hedera (@hedera) on X, 16 Jul 2026, 15:24 UTC — endorsement of the commitment. https://x.com/hedera/status/2077776401801847195

**9** — Brady Gentile (bmgentile), Bonzo Finance Labs, Discord #general-chat, 3 Nov 2026, 20:14 (message ID 1567270668498637001) — post "edited and approved by the Hedera Foundation and Hedera"; no loss calculations provided before publication. No public URL; export on file.

**10** — Bonzo Finance Discord #announcements: "Bonzo Lend Recovery: aToken Upgrade and Sweep Log", 2 Nov 2026; "Surplus Withdrawals, Conversions and Sales Log", 9 Nov 2026 — "an industry standard 10% of only those funds which were returned". Account-size breakdown, 1 Nov 2026, 21:30: "Under $25: 1,668 of 1,706 accounts fully covered. $25 - $1000: 106 of 461 fully covered. $1000 - $10,000: 69 of 261 fully covered. $10,000 and above: 32 of 107 fully covered." That breakdown was published when the shortfall stood at 660 accounts and 2,535 eligible, against 658 and 2,466 in the final portal figures. No public URL; export on file.

**11** — On-chain verification, Hedera mirror node (mainnet.mirrornode.hedera.com) and Ethereum mainnet, 21–25 Nov 2026. Wallet B: https://hashscan.io/mainnet/account/0.0.683607 · USDC payer: https://hashscan.io/mainnet/account/0.0.439415 · recovery contract: https://hashscan.io/mainnet/account/0.0.10940273

**12** — Bonzo Finance Labs, "Bonzo Lend: Recovery Portal Launch", 12 Nov 2026 — 2,466 eligible; 81.39% aggregate; 56.1%–100% range; 1,808 fully covered, 658 short; $1,065,255.68 outstanding. https://bonzo.finance/blog/bonzo-lend-recovery-portal-launch

**13** — Hedera Council, "Frequently Asked Questions": non-binding term sheet for a grant of "up to 7 billion hbars"; "a distribution of 50% of the total allocation (3.5 billion hbars) to Hedera Foundation on February 14, 2025"; and "On October 29, 2025, Hedera Council voted to re-allocate the remaining balance to the general Ecosystem & Open Source Development fund, with the planned grant to Hedera Foundation considered fully satisfied." https://www.hederacouncil.org/faq`
