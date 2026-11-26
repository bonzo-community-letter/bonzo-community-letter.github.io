## What happened?

**Between 29 June and 3 July 2026**, Supra patched a flaw in its oracle verifier on at least eleven
blockchains. Hedera and Fuse were not among them. Hedera received the same patch on **11 July at 07:08
UTC** — roughly six hours after the exploit — and Fuse on 12 July. Supra published no advisory describing
that rollout; the sequence is visible only on-chain.[6] A fix shipped to eleven chains inside five days,
with two deployments left behind and no notice to their integrators, is indistinguishable from a signal
that an unpatched verifier still existed on those two networks. Supra's CEO has since described the
exposure in his own words: the fault was "live... for two years straight... Fully visible. Fully on-chain.
Anyone could have found it. Nobody did."[7]

**On 11 July 2026**, that flaw in Supra's Hedera pull-oracle verifier let an attacker write a fabricated
price for a single pair, **SAUCE/wHBAR (pair 425)**.[14] The verifier accepted a proof whose public key and
signature were both the BLS identity element: a committee identifier outside the populated range produced
zero-valued key material, and a zero-valued signature satisfies the pairing equation for any message.
Supra's own report confirms the mechanism and states that its off-chain computation and signing
infrastructure was not compromised.[14] Every protocol reading that feed received the fabricated price.
Bonzo Lend read it as its sole price source, valued the attacker's 250 SAUCE — a few dollars of collateral
— far above its real worth, and allowed a borrow of **6,634,528.202695 USDC and 34,518,389.36109841
WHBAR**, worth **$9,061,019.76** at the recovery basis adopted in this process.[1][12]

**On 16 July 2026**, Bonzo published a commitment that affected users would receive "**advances covering
the full value of the losses to their affected positions** [...] backed by a recovery facility committed by
Hedera Foundation".[3] Bonzo has since stated that the post was "edited and approved by the Hedera
Foundation and Hedera", and that "no loss calculations were provided to them (or were asked to be
provided) before that post was approved and published".[4] The announcement was endorsed by Hedera's
official X account.[2]

**On 13 July 2026**, Supra's co-founder and CEO Josh Tobkin published an open letter to the attacker.
Return the funds, he wrote, and "Keep $100K - All charges dropped. Guaranteed job offer on the table." The
offer was "open for 72 hours". If refused, "there will be a $100K bounty on your head. Growing 10% a year
on top of inflation. Forever. Payable to anyone who turns you in."[7] The return address he published as
"a ~16 person multi-sig", `0x913BDd807608DEA920C689a7c3222E94e07551cC`, is a contract on Ethereum that
still holds no ETH, USDC, USDT, WETH or DAI.[13] Nothing was returned, and Supra has announced no
contribution to affected users.

**On 6 August 2026**, the white hat — "Wallet B" — returned 90% of the assets he had borrowed to shield the
protocol: 7,965,000 HBARX, 3,150,000 XSAUCE, 1,800,000 BONZO and 42.3 WETH. Bonzo allowed him to keep the
rest, which at pre-exploit prices was **$103,226.28**.[10][13] That bounty was not paid by Bonzo, Supra or
Hedera; it came out of the recovered pool, and therefore from the users. The release he signed also waived
his own claim on Bonzo Lend, valued at **$19,555.64** — reducing his net benefit to **$83,670.64, or 8.1%
of what he had taken**.[13]

**On 12 November 2026**, the recovery portal opened. It nets each account's borrowing against its supplied
assets at fixed 11 July prices and pays out in fixed token amounts, so every user carries whatever the
market has done since — including those whose collateral was seized by liquidation bots during the exploit
window.[12] After that netting, accounts that supplied only HBAR or USDC received **56.1%** of their net
entitlement, against a published range of 56.1% to 100%.[5] The aggregate was **81.39%**. The Hedera
Foundation's contribution was **795,431 USDC** — **42.8% of the $1,860,686.68 shortfall** borne by
non-institutional users.[5][13]

Roughly half of all eligible accounts held only HBAR or USDC and received 56.1%. **658 of 2,466 accounts —
26.7% — remain short, with $1,065,255.68 outstanding.**[5]

---

### Sources cited in this section

Full annotations are in `DRAFT-2026-11-21-A4.md`; the numbers are the same.

**1** — Bonzo Lend incident report, `bonzo.finance`, 11 Jul 2026.
**2** — @hedera on X, 16 Jul 2026, 15:24 UTC, `x.com/hedera/status/2077776401801847195` — endorsement of the
commitment.
**3** — Bonzo joint commitment post, 16 Jul 2026 — "advances covering the full value of the losses to their
affected positions [...] backed by a recovery facility committed by Hedera Foundation".
**4** — Brady Gentile, Bonzo Finance Labs, Discord #announcements, 1 Nov 2026 — post "edited and approved by
the Hedera Foundation and Hedera"; no loss calculations provided before publication.
**5** — Bonzo recovery portal launch, 12 Nov 2026 — 2,466 eligible; 81.39% aggregate; 56.1%–100% range;
1,808 fully covered, 658 short; $1,065,255.68 outstanding.
**6** — Tomachi Anura, "A signature made of zeros", 14 Jul 2026,
`x.com/TomachiAnura/article/2077007819912405116`; corroborated by BlockchainSecurity.rs, 22 Aug 2026.
Patch rollout 29 Jun–3 Jul on ≥11 chains; Hedera patched 11 Jul 07:08 UTC; Fuse 12 Jul; no public Supra
advisory describes the rollout.
**7** — Josh Tobkin, Supra co-founder and CEO, on X, 13 Jul 2026, 11:32 UTC,
`x.com/JoshuaTobkin/status/2076630890017587515`.
**10** — Bonzo Finance Discord, #announcements — "aToken Upgrade and Sweep Log" (2 Nov 2026) and "Surplus
Withdrawals, Conversions and Sales Log" (9 Nov 2026).
**12** — Bonzo, "Recovery Update: Claims Mechanism and Opening Timeline", 30 Oct 2026 — inventory captured at
block 101,581,825 (26 Oct 2026); prices fixed to 11 Jul 2026 observations; USDC = $1.00.
**13** — On-chain verification, Hedera mirror node and Ethereum mainnet, 21–25 Nov 2026: Wallet B's transfers
and retained balances; the Foundation's 795,431 USDC receipt; the Tobkin return address holding zero.
**14** — Supra, "Security Incident Report: Hedera Pull-Oracle Verifier", 11 Jul 2026, 13:55 UTC,
`supra.com/news/security-incident-report-hedera-pull-oracle-verifier`.
