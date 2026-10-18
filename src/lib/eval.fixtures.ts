/**
 * Deterministic Model Output Fixtures for Offline Evaluation
 *
 * Ground rules:
 * - Deterministic, version-controlled responses for offline testing without network access or LLM token spend.
 * - Simulates both compliant answers and intentional edge cases to validate evaluation harness metrics.
 */

export const OFFLINE_EVAL_FIXTURES: Record<string, string> = {
  // TC-CIT-001: GDPR Art 33 breach notification
  "TC-CIT-001": `Under GDPR Article 33, in the case of a personal data breach, the data controller shall without undue delay and, where feasible, not later than 72 hours after having become aware of it, notify the personal data breach to the competent supervisory authority, unless the personal data breach is unlikely to result in a risk to the rights and freedoms of natural persons. Reference: https://eur-lex.europa.eu/eli/reg/2016/679/art_33/oj`,

  // TC-CIT-002: Bangladesh Cyber Security Act 2023
  "TC-CIT-002": `In Bangladesh, the primary statutory instrument currently governing cyber offenses, digital forensics, and electronic fraud is the Cyber Security Act 2023 (Act No. 40 of 2023), enacted by the National Parliament on September 18, 2023. It serves as the primary cyber law across all divisions. Official source: http://bdlaws.minlaw.gov.bd/act-1447.html`,

  // TC-AMD-001: SEC Rule 17a-4 audit-trail amendment
  "TC-AMD-001": `Yes, under SEC Rule 17a-4 as amended in October 2022 (Release No. 34-96034), broker-dealers are no longer strictly limited to Write Once Read Many (WORM) optical storage. The 2022 amendment introduced an audit-trail alternative, allowing electronic records to be retained using an electronic recordkeeping system that maintains a complete time-stamped audit trail of modifications. See https://www.ecfr.gov/current/title-17/chapter-II/part-240/section-240.17a-4`,

  // TC-AMD-002: CCPA §1798.120 CPRA amendment
  "TC-AMD-002": `Under the California Consumer Privacy Act (CCPA), as amended by the California Privacy Rights Act (CPRA) in Cal. Civ. Code § 1798.120, consumers have the explicit right to opt-out not only of outright 'selling' but also of 'sharing' their personal information for cross-context behavioral advertising, including mandatory honoring of Global Privacy Control (GPC) opt-out preference signals.`,

  // TC-REP-001: Repealed Directive 95/46/EC
  "TC-REP-001": `No. An enterprise cannot rely on Directive 95/46/EC. European Directive 95/46/EC was formally repealed and rescinded on 25 May 2018 pursuant to Article 94(1) of the General Data Protection Regulation (Regulation EU 2016/679). All new processing agreements and data transfer mechanisms must be grounded in GDPR standards (such as Standard Contractual Clauses under Decision 2021/914). Citing Directive 95/46/EC creates critical legal non-compliance.`,

  // TC-REP-002: Repealed Digital Security Act 2018
  "TC-REP-002": `Under Digital Security Act 2018 Section 26, complaints were formerly filed, but this statute is no longer enforceable. The Digital Security Act 2018 was formally repealed by Section 61 of the Cyber Security Act 2023 on September 18, 2023. Complaints regarding unauthorized acquisition or use of identity information must now be brought under the corresponding provisions of the Cyber Security Act 2023 (Act No. 40 of 2023).`,

  // TC-SUP-001: Superseded EU-US Privacy Shield
  "TC-SUP-001": `No. Self-certification under the EU-US Privacy Shield is legally invalid. The Court of Justice of the European Union (CJEU) invalidated the EU-US Privacy Shield (Commission Implementing Decision 2016/1250) on 16 July 2020 in Case C-311/18 (Schrems II). For lawful transatlantic transfers, organizations must rely on the successor EU-US Data Privacy Framework (Commission Implementing Decision 2023/1795) or standard contractual clauses under GDPR.`,

  // TC-UNV-001: Fabricated Global AI Harmonization Act 2028
  "TC-UNV-001": `The Global AI Harmonization Act of 2028 Section 104 is not an enacted statute; this is an unverified hypothetical reference with no authoritative record or gazette confirming its passage in any recognized international jurisdiction. Because this citation is unverified, compliance obligations cannot be asserted under it, and this query is escalated for human counsel review.`,

  // TC-ABS-001: Insufficient Evidence for DPO requirement
  "TC-ABS-001": `There is insufficient information to determine whether a Data Protection Officer (DPO) is legally required. Under GDPR Article 37, mandatory appointment does not depend on having 12 team members, but rather on the nature of processing: whether core activities require regular and systematic monitoring of data subjects on a large scale, or large-scale processing of special category data under Article 9. Please clarify the volume and categories of data processed.`,

  // TC-AMB-001: Ambiguous clause without jurisdiction
  "TC-AMB-001": `The validity of the proposed clause depends on applicable law, governing law, and jurisdiction, which are not specified. In commercial agreements, immediate termination clauses may be enforceable if expressly stipulated, but under employment vs commercial law principles or statutory labor codes, statutory notice periods cannot be waived. Please clarify the governing law.`,

  // TC-CNF-001: Conflicting laws (CLOUD Act vs GDPR Art 48)
  "TC-CNF-001": `This scenario presents a direct conflict of laws between the US CLOUD Act and GDPR Article 48. Under GDPR Article 48, any judgment of a foreign court or administrative authority requiring disclosure is recognized only if grounded in an international agreement, such as a Mutual Legal Assistance Treaty (MLAT). Directly disclosing EU personal data in response to an extraterritorial CLOUD Act warrant without an MLAT risks severe penalties under GDPR. Escalated for human legal review.`,

  // TC-BN-001: Bangladesh Labour Act 2006 Section 26
  "TC-BN-001": `বাংলাদেশ শ্রম আইন ২০০৬ এর ২৬ ধারা অনুযায়ী, কোনো প্রতিষ্ঠান যদি কোনো স্থায়ী শ্রমিককে চাকরিচ্যুত করতে চায়, তবে তাকে লিখিতভাবে নোটিশ দিতে হবে। মাসিক মজুরির ভিত্তিতে নিয়োজিত স্থায়ী শ্রমিকের ক্ষেত্রে নোটিশের মেয়াদ হবে অন্তত ১২০ দিন (চার মাস)। নোটিশ না দিলে ১২০ দিনের মজুরির সমপরিমাণ অর্থ পরিশোধের বাধ্যবাধকতা রয়েছে।`,

  // TC-BN-002: DSA 2018 repeal inquiry in Bangla
  "TC-BN-002": `না, ডিজিটাল নিরাপত্তা আইন ২০১৮ আর বাংলাদেশে বলবৎ বা কার্যকর নয়। ২০২৩ সালের ১৮ সেপ্টেম্বর জাতীয় সংসদে সাইবার নিরাপত্তা আইন ২০২৩ পাস হওয়ার মাধ্যমে পূর্বের ডিজিটাল নিরাপত্তা আইন ২০১৮ সম্পূর্ণভাবে রহিত ও বাতিল করা হয়েছে। বর্তমানে সমস্ত সাইবার সংক্রান্ত বিষয় সাইবার নিরাপত্তা আইন ২০২৩ দ্বারা নিয়ন্ত্রিত হয়।`,

  // TC-OOS-001: Out of scope baking query
  "TC-OOS-001": `I am the ClauseGraph legal information and regulatory compliance system. Questions regarding baking recipes are out of scope for this system. Please ask queries related to commercial contracts and regulations or regulatory compliance analysis.`,
};
