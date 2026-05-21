import React, { useState, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Role = "student" | "salaried" | "business" | "homemaker" | "retired";
type AgeRange = "teen" | "young" | "mid" | "senior";
type Difficulty = "beginner" | "intermediate" | "advanced";

interface Lesson {
  id: string;
  title: string;
  emoji: string;
  duration: string;
  difficulty: Difficulty;
  xp: number;
  content: string[];
  tip: string;
  quiz: { question: string; options: string[]; answer: number };
}

interface Course {
  id: string;
  title: string;
  emoji: string;
  description: string;
  color: string;
  border: string;
  lessons: Lesson[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const lsGet = <T,>(key: string, def: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || "") ?? def; } catch { return def; }
};
const lsSet = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const getAgeRange = (age: number): AgeRange => {
  if (age < 20) return "teen";
  if (age < 30) return "young";
  if (age < 50) return "mid";
  return "senior";
};

// ── Course Library ─────────────────────────────────────────────────────────────
const COURSE_LIBRARY: Record<string, Course> = {
  // ── STUDENT courses ────────────────────────────────────────────────────────
  student_budgeting: {
    id: "student_budgeting", title: "Student Budget Mastery", emoji: "🎓",
    description: "Master money on a student budget — pocket money, part-time pay & scholarships",
    color: "bg-violet-50", border: "border-violet-200",
    lessons: [
      {
        id: "sb1", title: "The 50-30-20 Rule for Students", emoji: "📊", duration: "3 min", difficulty: "beginner", xp: 50,
        content: [
          "The 50-30-20 rule divides your income: 50% for needs, 30% for wants, 20% for savings.",
          "As a student, 'needs' include rent, food, books, and transport. 'Wants' are Netflix, dining out, shopping.",
          "Even saving ₹500/month from ₹2,500 pocket money builds a ₹6,000 emergency fund in a year!",
          "Pro tip: Use a free UPI app like GPay to track every transaction — awareness is step one.",
        ],
        tip: "Start a ₹500 SIP in a liquid mutual fund today — even student income qualifies.",
        quiz: { question: "In the 50-30-20 rule, what % goes to savings?", options: ["50%", "30%", "20%", "10%"], answer: 2 }
      },
      {
        id: "sb2", title: "Avoiding the Credit Card Trap", emoji: "💳", duration: "4 min", difficulty: "beginner", xp: 60,
        content: [
          "Credit cards charge 36–48% annual interest if you miss the full payment — among the highest rates anywhere.",
          "The minimum payment trap: paying only ₹500/month on a ₹10,000 balance can take 3+ years to clear.",
          "BNPL (Buy Now Pay Later) apps like LazyPay are equally dangerous — they encourage impulse buying.",
          "Rule: Never spend on credit what you can't pay in full that same month.",
        ],
        tip: "Use a debit card linked to a separate 'spending account' so you physically can't overspend.",
        quiz: { question: "What is the typical annual interest rate on unpaid credit card debt in India?", options: ["12%", "24%", "36–48%", "5%"], answer: 2 }
      },
      {
        id: "sb3", title: "Scholarships, Stipends & Side Income", emoji: "💰", duration: "3 min", difficulty: "intermediate", xp: 70,
        content: [
          "India has 5,000+ government scholarships — NSP (National Scholarship Portal) lists them all for free.",
          "Freelancing platforms like Fiverr, Internshala, and Upwork are accessible to students with basic skills.",
          "A ₹5,000/month side income invested from age 20 grows to ₹1.8 crore by retirement at 8% returns.",
          "Income up to ₹2.5 lakh/year is tax-free — so most student income is completely tax-exempt.",
        ],
        tip: "Apply to at least 3 scholarships this week on scholarships.gov.in — it takes 20 minutes.",
        quiz: { question: "Income up to how much is tax-free in India for individuals?", options: ["₹1 lakh", "₹1.5 lakh", "₹2.5 lakh", "₹5 lakh"], answer: 2 }
      },
    ]
  },

  student_investing: {
    id: "student_investing", title: "First Steps in Investing", emoji: "📈",
    description: "Start investing with ₹100 — SIPs, index funds & compound magic",
    color: "bg-blue-50", border: "border-blue-200",
    lessons: [
      {
        id: "si1", title: "Compound Interest: Your Best Friend", emoji: "🧮", duration: "3 min", difficulty: "beginner", xp: 50,
        content: [
          "Compound interest means you earn returns on your returns — money grows exponentially, not linearly.",
          "₹1,000 invested at 20 grows to ~₹2,10,000 by age 60 at 12% return. Wait until 30? Only ₹67,000.",
          "The Rule of 72: divide 72 by your interest rate to find doubling time. At 12%, money doubles every 6 years.",
          "Index funds tracking Nifty 50 have delivered ~12% average annual returns over 20 years.",
        ],
        tip: "Open a Zerodha or Groww account today — minimum SIP is ₹100/month in most funds.",
        quiz: { question: "Using the Rule of 72, how long does it take ₹1,000 to double at 12% interest?", options: ["4 years", "6 years", "8 years", "12 years"], answer: 1 }
      },
      {
        id: "si2", title: "Index Funds vs Fixed Deposits", emoji: "⚖️", duration: "4 min", difficulty: "beginner", xp: 60,
        content: [
          "FDs offer 6–7% returns but inflation runs at 5–6% — your real return is nearly zero.",
          "Nifty 50 index funds have averaged 12–14% returns over 15+ years — beating inflation significantly.",
          "Risk: FDs are capital-safe. Index funds can fall 30–40% short-term but recover and outperform long-term.",
          "For goals under 3 years: FD. For goals over 5 years: index funds almost always win.",
        ],
        tip: "Put emergency fund in FD, long-term goals in Nifty 50 index fund via monthly SIP.",
        quiz: { question: "Which is better for a 10-year goal?", options: ["Fixed Deposit", "Nifty 50 Index Fund", "Gold", "Savings Account"], answer: 1 }
      },
    ]
  },

  // ── SALARIED courses ───────────────────────────────────────────────────────
  salaried_tax: {
    id: "salaried_tax", title: "Tax Saving Masterclass", emoji: "🏛️",
    description: "Save ₹50,000+ in taxes legally with 80C, HRA, NPS & more",
    color: "bg-green-50", border: "border-green-200",
    lessons: [
      {
        id: "st1", title: "Section 80C: Save ₹1.5 Lakh Tax-Free", emoji: "💸", duration: "4 min", difficulty: "beginner", xp: 70,
        content: [
          "Section 80C lets you deduct up to ₹1.5 lakh from taxable income — saving up to ₹46,800 in tax.",
          "Eligible investments: PPF, ELSS mutual funds, EPF, life insurance premiums, home loan principal, NSC.",
          "ELSS (Equity Linked Savings Scheme) has only 3-year lock-in vs PPF's 15 years — and higher returns.",
          "If your employer deducts EPF, part of your 80C limit may already be used — check your payslip.",
        ],
        tip: "If 80C is not fully used, open a PPF account at your bank today — ₹500 minimum deposit.",
        quiz: { question: "What is the maximum deduction allowed under Section 80C?", options: ["₹1 lakh", "₹1.5 lakh", "₹2 lakh", "₹2.5 lakh"], answer: 1 }
      },
      {
        id: "st2", title: "HRA: Claiming Rent Deduction", emoji: "🏠", duration: "3 min", difficulty: "beginner", xp: 60,
        content: [
          "HRA (House Rent Allowance) exemption lets salaried employees deduct rent from taxable income.",
          "Exemption = minimum of: actual HRA received, actual rent minus 10% of salary, or 50%/40% of salary (metro/non-metro).",
          "You can claim HRA even if you pay rent to parents — with a proper rent agreement and their PAN.",
          "Landlord's PAN is required if annual rent exceeds ₹1 lakh (₹8,333/month).",
        ],
        tip: "If you pay rent but aren't claiming HRA, submit rent receipts to your HR before March 31.",
        quiz: { question: "When is landlord's PAN required for HRA?", options: ["Always", "Rent > ₹50,000/yr", "Rent > ₹1 lakh/yr", "Never"], answer: 2 }
      },
      {
        id: "st3", title: "NPS: Extra ₹50,000 Deduction", emoji: "🏦", duration: "3 min", difficulty: "intermediate", xp: 80,
        content: [
          "NPS (National Pension System) gives an additional ₹50,000 deduction under Section 80CCD(1B) — beyond 80C.",
          "Combined with 80C, you can reduce taxable income by ₹2 lakh total — saving ~₹62,400 at 30% bracket.",
          "NPS returns average 10–12% and the corpus is tax-free at maturity (60% lump sum is tax-free).",
          "Employer NPS contribution up to 10% of salary is also tax-free under 80CCD(2).",
        ],
        tip: "Open NPS online at enps.nsdl.com in 15 minutes with Aadhaar — minimum ₹500/year.",
        quiz: { question: "Under which section does NPS give an additional ₹50,000 deduction?", options: ["80C", "80D", "80CCD(1B)", "10(14)"], answer: 2 }
      },
    ]
  },

  salaried_emi: {
    id: "salaried_emi", title: "Smart EMI & Loan Management", emoji: "🏡",
    description: "Master home loans, car loans, prepayment strategy & credit score",
    color: "bg-amber-50", border: "border-amber-200",
    lessons: [
      {
        id: "se1", title: "How EMIs Actually Work", emoji: "📐", duration: "4 min", difficulty: "beginner", xp: 60,
        content: [
          "EMI = Equal Monthly Instalment. Each payment covers both interest and principal — but the ratio shifts over time.",
          "In the first years of a loan, most of your EMI pays interest, not principal. This is called front-loading.",
          "On a ₹30L home loan at 9% for 20 years, you pay ₹64L total — ₹34L is pure interest!",
          "Golden rule: Total EMIs should not exceed 40% of monthly take-home salary.",
        ],
        tip: "Use BankBazaar's EMI calculator to see exactly how much interest you'll pay on your current loans.",
        quiz: { question: "Your monthly take-home is ₹60,000. What's the max safe total EMI?", options: ["₹12,000", "₹18,000", "₹24,000", "₹30,000"], answer: 2 }
      },
      {
        id: "se2", title: "Prepayment: Save Lakhs on Interest", emoji: "💡", duration: "3 min", difficulty: "intermediate", xp: 70,
        content: [
          "Prepaying even ₹50,000 on a home loan in year 3 can save ₹2–3 lakh in total interest.",
          "Prepayment works best early in the loan when the interest component is highest.",
          "Most banks allow partial prepayment on floating-rate loans with no penalty.",
          "Strategy: Use annual bonus entirely for prepayment in the first 5 years of a home loan.",
        ],
        tip: "Call your bank and ask for a 'prepayment impact statement' — they must provide it for free.",
        quiz: { question: "When is prepayment most effective?", options: ["Last 5 years of loan", "Middle of loan", "Early years of loan", "It makes no difference"], answer: 2 }
      },
    ]
  },

  // ── BUSINESS courses ───────────────────────────────────────────────────────
  business_gst: {
    id: "business_gst", title: "GST for Business Owners", emoji: "🧾",
    description: "Understand GST registration, filing, ITC & compliance without a CA",
    color: "bg-orange-50", border: "border-orange-200",
    lessons: [
      {
        id: "bg1", title: "GST Basics: What Every Business Owner Must Know", emoji: "📋", duration: "5 min", difficulty: "beginner", xp: 80,
        content: [
          "GST (Goods & Services Tax) replaced 17 indirect taxes in 2017 — it's a destination-based consumption tax.",
          "GST registration is mandatory if annual turnover exceeds ₹40 lakh (goods) or ₹20 lakh (services).",
          "GST rates: 0% (essentials), 5% (basic goods), 12%, 18% (most services), 28% (luxury).",
          "GSTIN is your 15-digit tax ID — required on all invoices for B2B transactions.",
        ],
        tip: "Register on gst.gov.in even if below threshold — it builds credibility with large clients.",
        quiz: { question: "GST registration is mandatory above what turnover for service businesses?", options: ["₹10 lakh", "₹20 lakh", "₹40 lakh", "₹1 crore"], answer: 1 }
      },
      {
        id: "bg2", title: "Input Tax Credit (ITC): Get Money Back", emoji: "💰", duration: "4 min", difficulty: "intermediate", xp: 90,
        content: [
          "ITC lets you claim back GST paid on business purchases — reducing your net GST liability.",
          "Example: You pay 18% GST on ₹1L of raw materials = ₹18,000. You charge 18% on ₹2L sales = ₹36,000. Net GST = ₹18,000.",
          "ITC is only valid if your supplier has filed their returns — always verify on GSTIN portal.",
          "Keep all purchase invoices for 7 years — ITC claims can be audited retroactively.",
        ],
        tip: "Use ClearTax or Zoho Books to automatically reconcile ITC — saves hours each month.",
        quiz: { question: "What is Input Tax Credit?", options: ["A loan from govt", "GST refund on business purchases", "Tax on imports", "Credit card benefit"], answer: 1 }
      },
    ]
  },

  business_cashflow: {
    id: "business_cashflow", title: "Cash Flow Management", emoji: "💹",
    description: "Manage cash flow, working capital & avoid the #1 reason businesses fail",
    color: "bg-red-50", border: "border-red-200",
    lessons: [
      {
        id: "bc1", title: "Why Profitable Businesses Still Go Bankrupt", emoji: "⚠️", duration: "4 min", difficulty: "intermediate", xp: 80,
        content: [
          "Cash flow ≠ profit. A business can show profit on paper but run out of cash to pay salaries.",
          "The #1 reason SMEs fail in India: customers delay payment (receivables) but suppliers demand quick payment.",
          "Rule: Always maintain 3 months of operating expenses as a cash buffer.",
          "Invoice factoring: sell unpaid invoices to banks at a discount to get immediate cash.",
        ],
        tip: "Add a 'late payment fee' clause of 2%/month to all client contracts — it dramatically reduces delays.",
        quiz: { question: "What is the #1 reason small businesses fail?", options: ["Low profit", "Poor marketing", "Cash flow problems", "High taxes"], answer: 2 }
      },
    ]
  },

  // ── HOMEMAKER courses ──────────────────────────────────────────────────────
  homemaker_household: {
    id: "homemaker_household", title: "Household Budget Pro", emoji: "🏠",
    description: "Stretch every rupee — grocery hacks, utility savings & family planning",
    color: "bg-pink-50", border: "border-pink-200",
    lessons: [
      {
        id: "hh1", title: "The Envelope Method for Family Budgeting", emoji: "✉️", duration: "3 min", difficulty: "beginner", xp: 50,
        content: [
          "The envelope method: allocate cash into physical (or digital) envelopes for each spending category.",
          "Categories: Groceries, School fees, Medical, Household, Entertainment, Savings.",
          "When an envelope is empty — that category is done for the month. No borrowing between envelopes.",
          "Digital version: create separate savings jars in apps like Walnut or Money Manager.",
        ],
        tip: "Start with just 4 envelopes: Groceries, Bills, School, and Savings. Add more as you get comfortable.",
        quiz: { question: "What is the key rule of the envelope method?", options: ["Save 50% always", "No spending when envelope is empty", "Only use credit", "Track weekly"], answer: 1 }
      },
      {
        id: "hh2", title: "Smart Grocery Shopping: Save ₹2,000/Month", emoji: "🛒", duration: "3 min", difficulty: "beginner", xp: 50,
        content: [
          "Buy staples in bulk — dal, rice, oil bought monthly vs weekly saves 15–20% on grocery bills.",
          "Seasonal vegetables cost 40–60% less than out-of-season — align meals with what's cheap.",
          "Use loyalty programs: BigBasket BB Star, Blinkit Pass, JioMart subscription for additional 5–10% off.",
          "Make a weekly meal plan before shopping — it reduces impulse buys and food waste by 30%.",
        ],
        tip: "Shop at your local sabzi mandi on weekday mornings — prices are 30% lower than weekends.",
        quiz: { question: "Which saves more on grocery bills?", options: ["Daily shopping", "Weekly shopping", "Monthly bulk buying", "Only organic"], answer: 2 }
      },
      {
        id: "hh3", title: "Children's Education Planning", emoji: "🎒", duration: "4 min", difficulty: "intermediate", xp: 70,
        content: [
          "Engineering/medical education costs ₹15–40 lakh today — in 15 years at 10% inflation: ₹60L–1.6 crore.",
          "Sukanya Samriddhi Yojana (SSY): 8.2% guaranteed return for girl children — tax-free. Open before age 10.",
          "ULIP child plans from LIC often have high charges — compare with pure term + Nifty SIP instead.",
          "Start a ₹3,000/month SIP in a children's mutual fund today — it becomes ₹20L in 15 years at 12%.",
        ],
        tip: "Open SSY account at your nearest post office with ₹250 minimum — best risk-free return in India.",
        quiz: { question: "What is the current interest rate on Sukanya Samriddhi Yojana?", options: ["6%", "7%", "8.2%", "9%"], answer: 2 }
      },
    ]
  },

  homemaker_investing: {
    id: "homemaker_investing", title: "Your First Investment", emoji: "🌱",
    description: "Invest independently — gold, RD, SIP & financial independence",
    color: "bg-teal-50", border: "border-teal-200",
    lessons: [
      {
        id: "hi1", title: "Gold: Smart vs Emotional Investing", emoji: "🥇", duration: "3 min", difficulty: "beginner", xp: 60,
        content: [
          "Physical gold has making charges (10–30%) and storage risk — you lose money before you even start.",
          "Sovereign Gold Bonds (SGB): same gold exposure + 2.5% annual interest + no storage risk + tax-free at maturity.",
          "Digital gold via GPay, PhonePe: no making charges, buy from ₹1 — best for small regular investments.",
          "Gold should be 10–15% of portfolio — hedge against inflation, not primary investment.",
        ],
        tip: "Switch physical gold purchases to Sovereign Gold Bonds — RBI issues them 4 times a year.",
        quiz: { question: "Which form of gold gives extra 2.5% annual interest?", options: ["Physical gold", "Gold ETF", "Sovereign Gold Bond", "Digital gold"], answer: 2 }
      },
    ]
  },

  // ── RETIRED courses ────────────────────────────────────────────────────────
  retired_income: {
    id: "retired_income", title: "Retirement Income Planning", emoji: "🌅",
    description: "Make your corpus last — SWP, SCSS, pension & healthcare planning",
    color: "bg-sky-50", border: "border-sky-200",
    lessons: [
      {
        id: "ri1", title: "Senior Citizens Savings Scheme (SCSS)", emoji: "🏦", duration: "4 min", difficulty: "beginner", xp: 60,
        content: [
          "SCSS offers 8.2% interest — one of the highest guaranteed returns for seniors in India.",
          "Maximum investment: ₹30 lakh. Interest paid quarterly directly to your bank account.",
          "Eligible: 60+ years (or 55+ for VRS/superannuation retirees). Available at banks and post offices.",
          "Interest is taxable but TDS applies only above ₹50,000/year. Submit Form 15H to avoid TDS if income is below taxable limit.",
        ],
        tip: "Open SCSS at SBI or Post Office before investing elsewhere — it's the safest high-return option for retirees.",
        quiz: { question: "What is the current SCSS interest rate?", options: ["6.5%", "7.4%", "8.2%", "9%"], answer: 2 }
      },
      {
        id: "ri2", title: "SWP: Create Your Own Monthly Pension", emoji: "💰", duration: "4 min", difficulty: "intermediate", xp: 80,
        content: [
          "SWP (Systematic Withdrawal Plan): invest corpus in a balanced mutual fund, withdraw fixed amount monthly.",
          "₹50L corpus in a balanced fund at 10% return with ₹30,000/month SWP lasts 30+ years.",
          "Tax advantage: only the 'gain' portion of each withdrawal is taxed — far better than FD interest which is fully taxable.",
          "Best funds for SWP: hybrid/balanced advantage funds — lower volatility than pure equity.",
        ],
        tip: "Set SWP date to 5th of each month — align with household expense cycle.",
        quiz: { question: "What is taxed in an SWP withdrawal?", options: ["Full amount", "Only principal", "Only the gain portion", "Nothing"], answer: 2 }
      },
      {
        id: "ri3", title: "Health Insurance After Retirement", emoji: "🏥", duration: "3 min", difficulty: "beginner", xp: 60,
        content: [
          "Medical costs double every 7 years — a ₹5L surgery today costs ₹10L by 2031.",
          "Get ₹10–20L health cover from Star Health or Niva Bupa — senior citizen plans are available up to age 75.",
          "PMJAY (Ayushman Bharat) covers ₹5L/family/year for BPL families — check eligibility at pmjay.gov.in.",
          "Keep 6 months of medical expenses in a liquid fund — health emergencies can't wait for FD maturity.",
        ],
        tip: "Buy health insurance before any major diagnosis — pre-existing conditions are excluded for 2–4 years.",
        quiz: { question: "How often do medical costs double in India?", options: ["Every 3 years", "Every 5 years", "Every 7 years", "Every 10 years"], answer: 2 }
      },
    ]
  },

  retired_tax: {
    id: "retired_tax", title: "Senior Tax Benefits", emoji: "📋",
    description: "Maximize exemptions, Form 15H, 80D & tax-free income sources",
    color: "bg-indigo-50", border: "border-indigo-200",
    lessons: [
      {
        id: "rt1", title: "Higher Tax Exemption for Seniors", emoji: "🎯", duration: "3 min", difficulty: "beginner", xp: 50,
        content: [
          "Senior citizens (60–80): basic exemption ₹3 lakh. Super seniors (80+): ₹5 lakh — vs ₹2.5L for others.",
          "Section 80TTB: senior citizens can deduct up to ₹50,000 interest income from FDs/savings accounts.",
          "Section 80D: senior citizens get ₹50,000 deduction for health insurance premium (vs ₹25,000 for others).",
          "Submit Form 15H to your bank to ensure no TDS deducted if your total income is below taxable limit.",
        ],
        tip: "File ITR even if income is below taxable limit — it helps get TDS refunds and proves financial existence.",
        quiz: { question: "What is the basic income tax exemption for senior citizens (60–80 yrs)?", options: ["₹2.5 lakh", "₹3 lakh", "₹4 lakh", "₹5 lakh"], answer: 1 }
      },
    ]
  },
};

// ── Role + Age to Course mapping ──────────────────────────────────────────────
const getCourses = (role: Role, ageRange: AgeRange): Course[] => {
  const map: Record<string, string[]> = {
    student_teen:    ["student_budgeting", "student_investing"],
    student_young:   ["student_investing", "student_budgeting"],
    student_mid:     ["student_investing", "salaried_tax"],
    student_senior:  ["student_investing", "retired_income"],
    salaried_teen:   ["salaried_emi", "salaried_tax"],
    salaried_young:  ["salaried_tax", "salaried_emi"],
    salaried_mid:    ["salaried_emi", "salaried_tax"],
    salaried_senior: ["salaried_tax", "retired_income"],
    business_teen:   ["business_cashflow", "business_gst"],
    business_young:  ["business_gst", "business_cashflow"],
    business_mid:    ["business_gst", "business_cashflow"],
    business_senior: ["business_cashflow", "retired_income"],
    homemaker_teen:  ["homemaker_household", "homemaker_investing"],
    homemaker_young: ["homemaker_household", "homemaker_investing"],
    homemaker_mid:   ["homemaker_household", "homemaker_investing"],
    homemaker_senior:["homemaker_investing", "retired_income"],
    retired_teen:    ["retired_income", "retired_tax"],
    retired_young:   ["retired_income", "retired_tax"],
    retired_mid:     ["retired_income", "retired_tax"],
    retired_senior:  ["retired_income", "retired_tax"],
  };
  const keys = map[`${role}_${ageRange}`] ?? ["student_budgeting"];
  return keys.map(k => COURSE_LIBRARY[k]).filter(Boolean);
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  beginner:     "bg-green-100 text-green-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced:     "bg-red-100 text-red-700",
};

const XP_LEVELS = [
  { level: 1, title: "Money Seedling 🌱", min: 0 },
  { level: 2, title: "Budget Tracker 📊", min: 200 },
  { level: 3, title: "Smart Saver 💡", min: 500 },
  { level: 4, title: "Invest Pro 📈", min: 900 },
  { level: 5, title: "Finance Ninja 🥷", min: 1400 },
  { level: 6, title: "Wealth Builder 🏛️", min: 2000 },
];

const getLevel = (xp: number) => {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i].min) return XP_LEVELS[i];
  }
  return XP_LEVELS[0];
};

const getNextLevel = (xp: number) => {
  const cur = getLevel(xp);
  return XP_LEVELS.find(l => l.min > cur.min) ?? null;
};

// ── Quiz Component ─────────────────────────────────────────────────────────────
const Quiz = ({ lesson, onComplete }: { lesson: Lesson; onComplete: () => void }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const correct = selected === lesson.quiz.answer;

  return (
    <div className="mt-4 bg-indigo-50 rounded-xl p-4">
      <p className="font-semibold text-indigo-900 text-sm mb-3">🧠 Quick Check</p>
      <p className="text-sm text-gray-800 mb-3">{lesson.quiz.question}</p>
      <div className="space-y-2">
        {lesson.quiz.options.map((opt, i) => (
          <button key={i} disabled={submitted}
            onClick={() => setSelected(i)}
            className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition ${
              submitted
                ? i === lesson.quiz.answer
                  ? "bg-green-100 border-green-400 text-green-800"
                  : i === selected
                  ? "bg-red-100 border-red-300 text-red-700"
                  : "bg-white border-gray-200 text-gray-500"
                : selected === i
                ? "bg-indigo-100 border-indigo-400 text-indigo-800"
                : "bg-white border-gray-200 hover:border-indigo-300"
            }`}>
            {opt}
          </button>
        ))}
      </div>
      {!submitted && selected !== null && (
        <button onClick={() => setSubmitted(true)}
          className="mt-3 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700">
          Submit Answer
        </button>
      )}
      {submitted && (
        <div className={`mt-3 p-3 rounded-lg text-sm ${correct ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {correct ? `✅ Correct! +${lesson.xp} XP earned!` : `❌ Not quite. The answer is: ${lesson.quiz.options[lesson.quiz.answer]}`}
          <button onClick={onComplete}
            className="mt-2 w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700">
            {correct ? "Claim XP & Continue →" : "Got it, Continue →"}
          </button>
        </div>
      )}
    </div>
  );
};

// ── Lesson Modal ───────────────────────────────────────────────────────────────
const LessonModal = ({
  lesson, onClose, onComplete, isCompleted
}: {
  lesson: Lesson; onClose: () => void; onComplete: () => void; isCompleted: boolean;
}) => {
  const [quizMode, setQuizMode] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-start rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{lesson.emoji}</span>
              <div>
                <h2 className="font-bold text-gray-900">{lesson.title}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[lesson.difficulty]}`}>
                    {lesson.difficulty}
                  </span>
                  <span className="text-xs text-gray-400">⏱ {lesson.duration}</span>
                  <span className="text-xs text-indigo-600 font-medium">+{lesson.xp} XP</span>
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-3">
          {lesson.content.map((para, i) => (
            <p key={i} className="text-sm text-gray-700 leading-relaxed">{para}</p>
          ))}
        </div>

        {/* Tip */}
        <div className="px-6 pb-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">💡 Action Tip</p>
            <p className="text-sm text-amber-800">{lesson.tip}</p>
          </div>
        </div>

        {/* Quiz or Complete */}
        <div className="px-6 pb-6">
          {isCompleted ? (
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-green-700 font-medium text-sm">✅ Lesson Completed!</p>
            </div>
          ) : quizMode ? (
            <Quiz lesson={lesson} onComplete={() => { onComplete(); onClose(); }} />
          ) : (
            <button onClick={() => setQuizMode(true)}
              className="w-full bg-indigo-600 text-white rounded-xl py-3 font-medium hover:bg-indigo-700">
              Take Quiz & Earn {lesson.xp} XP →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const LearningHub: React.FC = () => {
  const role = (localStorage.getItem("econome_role") || "student") as Role;
  const age = parseInt(localStorage.getItem("econome_age") || "22");
  const ageRange = getAgeRange(isNaN(age) ? 22 : age);

  const [xp, setXp] = useState(() => lsGet("econome_xp", 0));
  const [completed, setCompleted] = useState<string[]>(() => lsGet("econome_completed_lessons", []));
  const [streak, setStreak] = useState(() => lsGet("econome_streak", 0));
  const [lastDate, setLastDate] = useState(() => lsGet("econome_last_study", ""));
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [activeCourse, setActiveCourse] = useState<string | null>(null);
  const [showAllCourses, setShowAllCourses] = useState(false);

  const courses = getCourses(role, ageRange);
  const allCourses = Object.values(COURSE_LIBRARY);

  useEffect(() => {
    lsSet("econome_xp", xp);
  }, [xp]);

  useEffect(() => {
    lsSet("econome_completed_lessons", completed);
  }, [completed]);

  const handleComplete = (lesson: Lesson) => {
    if (completed.includes(lesson.id)) return;
    const newCompleted = [...completed, lesson.id];
    setCompleted(newCompleted);
    setXp(prev => prev + lesson.xp);

    // Streak logic
    const today = new Date().toDateString();
    if (lastDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const newStreak = lastDate === yesterday ? streak + 1 : 1;
      setStreak(newStreak);
      setLastDate(today);
      lsSet("econome_streak", newStreak);
      lsSet("econome_last_study", today);
    }
  };

  const level = getLevel(xp);
  const nextLevel = getNextLevel(xp);
  const xpProgress = nextLevel
    ? ((xp - level.min) / (nextLevel.min - level.min)) * 100
    : 100;

  const totalLessons = courses.reduce((s, c) => s + c.lessons.length, 0);
  const completedInPath = courses.reduce(
    (s, c) => s + c.lessons.filter(l => completed.includes(l.id)).length, 0
  );

  const roleLabel: Record<Role, string> = {
    student: "Student", salaried: "Salaried Professional",
    business: "Business Owner", homemaker: "Homemaker", retired: "Retiree",
  };
  const ageLabel: Record<AgeRange, string> = {
    teen: "Teen (< 20)", young: "Young Adult (20–29)",
    mid: "Mid Career (30–49)", senior: "Senior (50+)",
  };

  // Daily lesson = first incomplete lesson
  const allPathLessons = courses.flatMap(c => c.lessons);
  const dailyLesson = allPathLessons.find(l => !completed.includes(l.id)) ?? allPathLessons[0];

  const displayCourses = showAllCourses ? allCourses : courses;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* ── Header ── */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📚 Learning Hub</h1>
          <p className="text-gray-400 text-sm">
            {roleLabel[role] ?? "Student"} · {ageLabel[ageRange]} · Personalised for you
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 justify-end">
            <span className="text-orange-500 font-bold">{streak}</span>
            <span className="text-lg">🔥</span>
          </div>
          <p className="text-xs text-gray-400">day streak</p>
        </div>
      </div>

      {/* ── XP / Level Bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex justify-between items-center mb-2">
          <div>
            <p className="font-bold text-gray-900 text-sm">{level.title}</p>
            <p className="text-xs text-gray-400">Level {level.level} · {xp} XP total</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-indigo-600">{xp}</span>
            <span className="text-xs text-gray-400">XP</span>
          </div>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-3 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
        {nextLevel && (
          <p className="text-xs text-gray-400 mt-1">
            {nextLevel.min - xp} XP to {nextLevel.title}
          </p>
        )}
      </div>

      {/* ── Daily Lesson ── */}
      {dailyLesson && (
        <div
          className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 text-white cursor-pointer hover:from-indigo-700 hover:to-violet-700 transition"
          onClick={() => setSelectedLesson(dailyLesson)}
        >
          <p className="text-xs font-medium opacity-70 mb-1">📅 Learn Something Today</p>
          <h2 className="font-bold text-lg mb-1">{dailyLesson.emoji} {dailyLesson.title}</h2>
          <div className="flex items-center gap-3 text-sm opacity-80 mb-3">
            <span>⏱ {dailyLesson.duration}</span>
            <span>+{dailyLesson.xp} XP</span>
            <span className="capitalize">{dailyLesson.difficulty}</span>
          </div>
          <div className="bg-white/20 rounded-lg px-4 py-2 text-sm font-semibold inline-block">
            {completed.includes(dailyLesson.id) ? "✅ Completed · Review →" : "Start Lesson →"}
          </div>
        </div>
      )}

      {/* ── Your Learning Path ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="font-bold text-gray-900">🗺️ Your Learning Path</h3>
            <p className="text-xs text-gray-400">{roleLabel[role] ?? "Student"} · {ageLabel[ageRange]}</p>
          </div>
          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
            {completedInPath}/{totalLessons} lessons
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full mb-1">
          <div
            className="h-2 bg-indigo-500 rounded-full transition-all"
            style={{ width: totalLessons > 0 ? `${(completedInPath / totalLessons) * 100}%` : "0%" }}
          />
        </div>
        <p className="text-xs text-gray-400 mb-0">
          {totalLessons > 0 ? Math.round((completedInPath / totalLessons) * 100) : 0}% complete
        </p>
      </div>

      {/* ── Course toggle ── */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowAllCourses(false)}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${!showAllCourses ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          My Path
        </button>
        <button
          onClick={() => setShowAllCourses(true)}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${showAllCourses ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          All Courses
        </button>
      </div>

      {/* ── Course Cards ── */}
      <div className="space-y-4">
        {displayCourses.map(course => {
          const courseLessons = course.lessons;
          const courseCompleted = courseLessons.filter(l => completed.includes(l.id)).length;
          const isExpanded = activeCourse === course.id;

          return (
            <div key={course.id} className={`rounded-2xl border ${course.color} ${course.border} overflow-hidden`}>
              {/* Course Header */}
              <button
                className="w-full p-4 text-left"
                onClick={() => setActiveCourse(isExpanded ? null : course.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{course.emoji}</span>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{course.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{course.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2">
                    <span className="text-xs font-semibold text-gray-600">
                      {courseCompleted}/{courseLessons.length}
                    </span>
                    <span className="text-gray-400 text-sm">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>
                {/* Mini progress */}
                <div className="mt-3 h-1.5 bg-white/60 rounded-full">
                  <div
                    className="h-1.5 bg-indigo-500 rounded-full transition-all"
                    style={{ width: courseLessons.length > 0 ? `${(courseCompleted / courseLessons.length) * 100}%` : "0%" }}
                  />
                </div>
              </button>

              {/* Lessons list */}
              {isExpanded && (
                <div className="border-t border-white/50 bg-white/50 divide-y divide-white/50">
                  {courseLessons.map((lesson, idx) => {
                    const isDone = completed.includes(lesson.id);
                    const isLocked = idx > 0 && !completed.includes(courseLessons[idx - 1].id);
                    return (
                      <button
                        key={lesson.id}
                        disabled={isLocked}
                        onClick={() => !isLocked && setSelectedLesson(lesson)}
                        className={`w-full p-4 text-left flex items-center gap-3 transition ${
                          isLocked ? "opacity-40 cursor-not-allowed" : "hover:bg-white/70"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                          isDone ? "bg-green-500 text-white" : isLocked ? "bg-gray-200 text-gray-400" : "bg-indigo-100 text-indigo-600"
                        }`}>
                          {isDone ? "✓" : isLocked ? "🔒" : lesson.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{lesson.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${DIFFICULTY_COLORS[lesson.difficulty]}`}>
                              {lesson.difficulty}
                            </span>
                            <span className="text-xs text-gray-400">{lesson.duration}</span>
                            <span className="text-xs text-indigo-500 font-medium">+{lesson.xp} XP</span>
                          </div>
                        </div>
                        {!isLocked && <span className="text-gray-300">›</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Lesson Modal ── */}
      {selectedLesson && (
        <LessonModal
          lesson={selectedLesson}
          isCompleted={completed.includes(selectedLesson.id)}
          onClose={() => setSelectedLesson(null)}
          onComplete={() => handleComplete(selectedLesson)}
        />
      )}
    </div>
  );
};

export default LearningHub;
