## What happened?

**Between 29 June and 3 July 2026**, Supra patched a flaw in its oracle verifier on at least eleven
blockchains. Hedera and Fuse were not among them. Hedera received the same patch on **11 July at 07:08
UTC** — roughly six hours after the exploit — and Fuse on 12 July. Supra published no advisory describing
that rollout; the sequence is visible only on-chain.⁶ A fix shipped to eleven chains inside five days,
with two deployments left behind and no notice to their integrators, is indistinguishable from a signal
that an unpatched verifier still existed on those two networks. Supra's CEO has since described the
exposure in his own words: the fault was "live... for two years straight... Fully visible. Fully on-chain.
Anyone could have found it. Nobody did."⁷

**On 11 July 2026**, that flaw in Supra's Hedera pull-oracle verifier let an attacker write a fabricated
price for a single pair, **SAUCE/wHBAR (pair 425)**.¹⁴ The verifier accepted a proof whose public key and
signature were both the BLS identity element: a committee identifier outside the populated range produced
zero-valued key material, and a zero-valued signature satisfies the pairing equation for any message.
Supra's own report confirms the mechanism and states that its off-chain computation and signing
infrastructure was not compromised.¹⁴ Every protocol reading that feed received the fabricated price.
Bonzo Lend read it as its sole price source, valued the attacker's 250 SAUCE — a few dollars of collateral
— far above its real worth, and allowed a borrow of **6,634,528.202695 USDC and 34,518,389.36109841
WHBAR**, worth **$9,061,019.76** at the recovery basis adopted in this process.¹,¹²

**On 16 July 2026**, Bonzo published a commitment that affected users would receive "**advances covering
the full value of the losses to their affected positions** [...] backed by a recovery facility committed by
Hedera Foundation".³ Bonzo has since stated that the post was "edited and approved by the Hedera
Foundation and Hedera", and that "no loss calculations were provided to them (or were asked to be
provided) before that post was approved and published".⁴ The announcement was endorsed by Hedera's
official X account.²

**On 13 July 2026**, Supra's co-founder and CEO Josh Tobkin published an open letter to the attacker.
Return the funds, he wrote, and "Keep $100K - All charges dropped. Guaranteed job offer on the table." The
offer was "open for 72 hours". If refused, "there will be a $100K bounty on your head. Growing 10% a year
on top of inflation. Forever. Payable to anyone who turns you in."⁷ The return address he published as
"a ~16 person multi-sig", `0x913BDd807608DEA920C689a7c3222E94e07551cC`, is a contract on Ethereum that
still holds no ETH, USDC, USDT, WETH or DAI.¹³ Nothing was returned, and Supra has announced no
contribution to affected users.

**On 6 August 2026**, the white hat — "Wallet B" — returned 90% of the assets he had borrowed to shield the
protocol: 7,965,000 HBARX, 3,150,000 XSAUCE, 1,800,000 BONZO and 42.3 WETH. Bonzo allowed him to keep the
rest, which at pre-exploit prices was **$103,226.28**.¹⁰,¹³ That bounty was not paid by Bonzo, Supra or
Hedera; it came out of the recovered pool, and therefore from the users. The release he signed also waived
his own claim on Bonzo Lend, valued at **$19,555.64** — reducing his net benefit to **$83,670.64, or 8.1%
of what he had taken**.¹³

**On 12 November 2026**, the recovery portal opened. It nets each account's borrowing against its supplied
assets at fixed 11 July prices and pays out in fixed token amounts, so every user carries whatever the
market has done since — including those whose collateral was seized by liquidation bots during the exploit
window.¹² After that netting, accounts that supplied only HBAR or USDC received **56.1%** of their net
entitlement, against a published range of 56.1% to 100%.⁵ The aggregate was **81.39%**. The Hedera
Foundation's contribution was **795,431 USDC** — **42.8% of the $1,860,686.68 shortfall** borne by
non-institutional users.⁵,¹³

Roughly half of all eligible accounts held only HBAR or USDC and received 56.1%. **658 of 2,466 accounts —
26.7% — remain short, with $1,065,255.68 outstanding.**⁵
