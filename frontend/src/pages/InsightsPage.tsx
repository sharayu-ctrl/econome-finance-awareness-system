import React, { useState, useMemo } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────
const lsGet = <T,>(key: string, def: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || "") ?? def; } catch { return def; }
};
const fmt = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// ── Types ─────────────────────────────────────────────────────────────────────
interface UserProfile {
  name: string; role: string; age: number;
  income: number; expenses: number; savingsGoal: number;
  emi: number; budgetGoal: number;
}
interface XAIFactor {
  label: string; weight: number;
  direction: "positive" | "negative" | "neutral"; explanation: string;
}
interface Recommendation {
  title: string; action: string; impact: string; priority: "high" | "medium" | "low";
}
interface ForecastMonth { month: string; savings: number; cumulative: number; }
interface WhatIfResult { scenario: string; result: string; delta: number; }

// ── Live economic snapshot (hardcoded live-ish values) ────────────────────────
const ECON = { usdInr: 83.62, cpi: 5.4, repoRate: 6.5, crude: 82.4, nifty: 22530 };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Core AI Engine (pure deterministic logic) ─────────────────────────────────
function runAIEngine(p: UserProfile) {
  const net = p.income - p.expenses - p.emi;
  const savingsRate = p.income > 0 ? (net / p.income) * 100 : 0;
  const emiRatio = p.income > 0 ? (p.emi / p.income) * 100 : 0;
  const budgetUtil = p.budgetGoal > 0 ? (p.expenses / p.budgetGoal) * 100 : 100;
  const inflationErosion = (ECON.cpi / 100) * p.income / 12;
  const realNet = net - inflationErosion;

  // ── Health Score (0–100) ──────────────────────────────────────────────────
  let score = 50;
  score += clamp(savingsRate * 1.2, -25, 25);      // savings rate ±25
  score -= clamp(emiRatio * 0.6, 0, 20);            // high EMI penalty
  score -= clamp((budgetUtil - 80) * 0.4, 0, 15);  // over-budget penalty
  score -= clamp(ECON.cpi * 1.5, 0, 10);            // inflation penalty
  score += p.savingsGoal > 0 && net > 0 ? 5 : 0;   // has goal bonus
  score = Math.round(clamp(score, 5, 98));

  // ── Headline ──────────────────────────────────────────────────────────────
  const headlines: Record<string, string[]> = {
    high: [
      `Your ${savingsRate.toFixed(0)}% savings rate puts you ahead of 80% of Indians`,
      `Strong foundations: saving ${fmt(net)}/month despite ${ECON.cpi}% inflation`,
    ],
    mid: [
      `You're saving ${fmt(net)}/month — good start, room to optimise`,
      `Moderate health score: inflation is quietly eroding ${fmt(inflationErosion)}/month`,
    ],
    low: [
      `Action needed: only ${savingsRate.toFixed(0)}% savings rate with ${ECON.cpi}% inflation`,
      `Your expenses + EMI leave limited buffer — small shocks could destabilise finances`,
    ],
  };
  const tier = score >= 65 ? "high" : score >= 40 ? "mid" : "low";
  const headline = headlines[tier][0];

  // ── Summary ───────────────────────────────────────────────────────────────
  const roleCtx: Record<string, string> = {
    student: "As a student, building habits now compounds massively over time.",
    salaried: "As a salaried professional, your predictable income is your biggest asset.",
    business: "As a business owner, separating personal and business cash flow is critical.",
    homemaker: "As a homemaker, your spending decisions directly drive family wealth.",
    retired: "As a retiree, protecting corpus and beating inflation is the core priority.",
  };
  const summary = `${roleCtx[p.role] || "Your financial profile shows"} With ₹${p.income.toLocaleString("en-IN")} income and ₹${p.expenses.toLocaleString("en-IN")} expenses, you net ₹${net.toLocaleString("en-IN")}/month — a ${savingsRate.toFixed(1)}% savings rate. At ${ECON.cpi}% CPI inflation, ₹${inflationErosion.toFixed(0)} of real purchasing power erodes monthly, leaving a real surplus of ${fmt(Math.max(0, realNet))}. ${emiRatio > 35 ? `Your EMI burden of ${emiRatio.toFixed(0)}% of income is above the safe 35% threshold — this constrains your financial flexibility.` : `Your EMI-to-income ratio of ${emiRatio.toFixed(0)}% is within the safe zone.`}`;

  // ── XAI Factors ───────────────────────────────────────────────────────────
  const xaiFactors: XAIFactor[] = [
    {
      label: "Savings Rate",
      weight: clamp(savingsRate / 40, 0.05, 0.35),
      direction: savingsRate >= 20 ? "positive" : savingsRate >= 10 ? "neutral" : "negative",
      explanation: `Your ${savingsRate.toFixed(1)}% savings rate ${savingsRate >= 20 ? "exceeds" : "falls below"} the recommended 20% benchmark for ${p.role}s.`,
    },
    {
      label: "Inflation Erosion (CPI " + ECON.cpi + "%)",
      weight: clamp(ECON.cpi / 20, 0.1, 0.25),
      direction: ECON.cpi > 5 ? "negative" : "neutral",
      explanation: `At ${ECON.cpi}% CPI, your ₹${p.income.toLocaleString()} income loses ${fmt(inflationErosion)} in real value each month.`,
    },
    {
      label: "EMI Burden",
      weight: clamp(emiRatio / 120, 0.05, 0.3),
      direction: emiRatio > 40 ? "negative" : emiRatio > 20 ? "neutral" : "positive",
      explanation: `EMIs of ${fmt(p.emi)}/month are ${emiRatio.toFixed(0)}% of income — ${emiRatio > 40 ? "dangerously high, limiting financial flexibility" : "within manageable range"}.`,
    },
    {
      label: "Budget Discipline",
      weight: clamp(budgetUtil / 300, 0.1, 0.25),
      direction: budgetUtil < 80 ? "positive" : budgetUtil < 100 ? "neutral" : "negative",
      explanation: `You've used ${budgetUtil.toFixed(0)}% of your ₹${p.budgetGoal.toLocaleString()} monthly budget — ${budgetUtil < 80 ? "excellent discipline" : budgetUtil < 100 ? "on track" : "over budget this month"}.`,
    },
    {
      label: "Repo Rate Impact (" + ECON.repoRate + "%)",
      weight: 0.12,
      direction: ECON.repoRate > 6.5 ? "negative" : "neutral",
      explanation: `RBI's ${ECON.repoRate}% repo rate directly sets your loan interest costs and FD returns — ${ECON.repoRate > 6.5 ? "elevated rates increase EMI burden" : "stable rates keep borrowing costs manageable"}.`,
    },
  ];
  // Normalize weights to sum to 1
  const totalW = xaiFactors.reduce((s, f) => s + f.weight, 0);
  xaiFactors.forEach(f => { f.weight = parseFloat((f.weight / totalW).toFixed(2)); });

  // ── Recommendations (role + situation aware) ──────────────────────────────
  const recs: Recommendation[] = [];

  // High EMI
  if (emiRatio > 35) recs.push({
    title: "Reduce EMI Burden", priority: "high",
    action: `Your EMI is ${emiRatio.toFixed(0)}% of income. Prepay ₹${Math.round(p.emi * 3).toLocaleString()} (3 months' EMI) on your highest-interest loan to cut future interest significantly.`,
    impact: `Could save ₹${Math.round(p.emi * 0.15 * 12).toLocaleString()} in interest over next year`,
  });

  // Low savings rate
  if (savingsRate < 20) recs.push({
    title: "Boost Savings Rate to 20%", priority: "high",
    action: `Start a ₹${Math.max(500, Math.round((p.income * 0.2 - net) / 500) * 500).toLocaleString()}/month SIP in a Nifty 50 index fund (Groww/Zerodha, min ₹100). Automate it on salary day.`,
    impact: `Reaching 20% savings rate adds ${fmt((p.income * 0.2 - net) * 12)} to annual savings`,
  });

  // Over budget
  if (budgetUtil > 90) recs.push({
    title: "Trim Discretionary Spending", priority: "high",
    action: `Audit your top 3 expense categories. Cut entertainment and dining by 20% — that's ₹${Math.round(p.expenses * 0.08).toLocaleString()}/month redirected to savings.`,
    impact: `Saves ₹${Math.round(p.expenses * 0.08 * 12).toLocaleString()} per year`,
  });

  // Role-specific
  if (p.role === "salaried") recs.push({
    title: "Maximise 80C Tax Saving", priority: "medium",
    action: `Invest ₹${Math.min(12500, Math.round(p.income * 0.15)).toLocaleString()}/month in ELSS or PPF to exhaust your ₹1.5L annual 80C limit and save up to ₹46,800 in tax.`,
    impact: "Up to ₹46,800 annual tax saving",
  });
  if (p.role === "student") recs.push({
    title: "Start a ₹500 SIP Now", priority: "high",
    action: "Open a Groww or Zerodha account (free, under 18 OK with guardian). Start ₹500/month in Nifty 50 index fund — the earlier you start, the more compound interest works for you.",
    impact: "₹500/month from age 20 = ₹27L by age 45 at 12% return",
  });
  if (p.role === "business") recs.push({
    title: "Maintain 3-Month Cash Buffer", priority: "high",
    action: `Keep ₹${Math.round(p.expenses * 3).toLocaleString()} (3 months' expenses) in a liquid mutual fund — not savings account. Earns 6-7% vs 3.5% in savings, while staying instantly accessible.`,
    impact: "Protects against revenue gaps; earns 3% more than savings account",
  });
  if (p.role === "homemaker") recs.push({
    title: "Open Sukanya / SSY Account", priority: "medium",
    action: "If you have a daughter under 10, open a Sukanya Samriddhi Yojana account at any post office with ₹250. Current rate: 8.2% — best guaranteed return in India.",
    impact: "₹1,000/month grows to ₹6.7L tax-free in 15 years at 8.2%",
  });
  if (p.role === "retired") recs.push({
    title: "Move Idle FD to SCSS", priority: "high",
    action: "Senior Citizen Savings Scheme gives 8.2% vs typical FD 6.5–7%. Max ₹30L. Quarterly interest credited to bank account — ideal for regular income.",
    impact: "Extra 1.2–1.7% on ₹10L = ₹12,000–17,000 more per year",
  });

  // Universal
  if (net > 0 && p.savingsGoal > 0) {
    const monthsToGoal = Math.ceil(p.savingsGoal / Math.max(1, net));
    recs.push({
      title: `Hit Your ₹${p.savingsGoal.toLocaleString()} Savings Goal`, priority: "medium",
      action: `At current savings of ${fmt(net)}/month, you'll reach your goal in ${monthsToGoal} months. Increase monthly savings by ₹${Math.round(net * 0.1).toLocaleString()} to reach it ${Math.round(monthsToGoal * 0.1)} months sooner.`,
      impact: `Goal achieved ${monthsToGoal > 6 ? "sooner with small top-up" : "on track"}`,
    });
  }

  recs.push({
    title: "Build 6-Month Emergency Fund", priority: net < p.expenses * 2 ? "high" : "low",
    action: `Target: ${fmt(p.expenses * 6)} in a liquid mutual fund (not FD — instant withdrawal). Currently ${net > 0 ? `saving ${fmt(net)}/month, so ${Math.ceil((p.expenses * 6) / Math.max(1, net))} months to reach target` : "no surplus — cut one expense category first"}.`,
    impact: "Protects against job loss, medical emergency, or business downturn",
  });

  // ── 6-Month Forecast ──────────────────────────────────────────────────────
  const now = new Date();
  let cumulative = 0;
  const forecast: ForecastMonth[] = Array.from({ length: 6 }, (_, i) => {
    const month = MONTHS[(now.getMonth() + 1 + i) % 12];
    // Simulate gradual inflation effect
    const inflationFactor = 1 + (ECON.cpi / 100) * (i / 12);
    const projectedExpenses = p.expenses * inflationFactor;
    const monthlySavings = Math.round(p.income - projectedExpenses - p.emi);
    cumulative += Math.max(0, monthlySavings);
    return { month, savings: monthlySavings, cumulative };
  });

  // ── Foresight ─────────────────────────────────────────────────────────────
  const foresightParts: string[] = [];
  if (ECON.cpi > 5) foresightParts.push(`With CPI at ${ECON.cpi}%, your real purchasing power will erode by approximately ${fmt(inflationErosion * 6)} over the next 6 months unless income grows.`);
  if (ECON.crude > 80) foresightParts.push(`Crude oil at $${ECON.crude}/barrel keeps petrol prices elevated — expect transport and food costs to drift 3–5% higher over the next quarter.`);
  if (emiRatio > 30) foresightParts.push(`If RBI raises rates by 0.25%, your floating-rate EMI could increase by ${fmt(p.emi * 0.015)}/month — consider fixing your rate now.`);
  if (savingsRate > 20) foresightParts.push(`At your current savings rate, you're on track to accumulate ${fmt(net * 12)} this year — invest in a Nifty SIP to beat inflation meaningfully.`);
  if (savingsRate < 10) foresightParts.push(`Without a savings buffer, any unexpected expense over ${fmt(p.income * 0.5)} could push you into debt — building even a ₹10,000 emergency fund is the highest-priority action.`);
  const foresight = foresightParts.slice(0, 3).join(" ");

  // ── What-If Engine ────────────────────────────────────────────────────────
  const whatIfEngine: Record<string, WhatIfResult> = {
    expense_up_10: {
      scenario: "Expenses rise 10%",
      delta: -Math.round(p.expenses * 0.1),
      result: `A 10% rise in expenses (₹${Math.round(p.expenses * 0.1).toLocaleString()}/month more) reduces your monthly savings from ${fmt(net)} to ${fmt(net - p.expenses * 0.1)}. ${net - p.expenses * 0.1 < 0 ? "This pushes you into a monthly deficit — you'd need to use savings or cut elsewhere." : "You'd still be saving, but your savings rate drops to " + ((net - p.expenses * 0.1) / p.income * 100).toFixed(1) + "%."}`,
    },
    income_down_20: {
      scenario: "Income drops 20%",
      delta: -Math.round(p.income * 0.2),
      result: `A 20% income cut (₹${Math.round(p.income * 0.2).toLocaleString()}/month) would leave you with ${fmt(p.income * 0.8 - p.expenses - p.emi)}/month. ${p.income * 0.8 - p.expenses - p.emi < 0 ? `You'd face a ₹${Math.abs(Math.round(p.income * 0.8 - p.expenses - p.emi)).toLocaleString()} monthly shortfall — your emergency fund would last ${p.income > 0 ? Math.round((p.expenses * 3) / Math.abs(p.income * 0.8 - p.expenses - p.emi)) : 0} months.` : "You'd still be cash-flow positive — a strong position."}`,
    },
    repo_up: {
      scenario: "Repo rate rises 0.5%",
      delta: -Math.round(p.emi * 0.02),
      result: `A 0.5% RBI rate hike typically adds ₹${Math.round(p.emi * 0.02).toLocaleString()}/month to floating-rate EMIs. Your total EMI burden would rise to ${fmt(p.emi * 1.02)}/month. FD and liquid fund returns would also improve by ~0.3–0.5%, partially offsetting the impact on savings.`,
    },
    sip_5k: {
      scenario: "I start ₹5,000 SIP",
      delta: -5000,
      result: `Starting a ₹5,000/month SIP in a Nifty 50 index fund reduces take-home by ₹5,000 but builds ₹${(5000 * 12).toLocaleString()} in investments per year. At 12% annual return over 10 years, this grows to ₹${(5000 * 12 * 17.5 / 12).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} — a strong wealth-building move despite the short-term cash impact.`,
    },
    job_loss: {
      scenario: "I lose my job for 3 months",
      delta: -Math.round(p.income),
      result: `With zero income for 3 months, you'd need ${fmt((p.expenses + p.emi) * 3)} from savings. ${(p.expenses + p.emi) * 3 > net * 6 ? `Your current savings buffer likely covers only ${Math.round(net * 6 / (p.expenses + p.emi))} months — building a 6-month emergency fund (${fmt((p.expenses + p.emi) * 6)}) should be your top priority.` : "Your savings buffer appears sufficient to weather this — good position."}`,
    },
    petrol_up: {
      scenario: "Petrol price rises ₹10/L",
      delta: -800,
      result: `A ₹10/L petrol hike adds roughly ₹600–1,200/month for an average Indian commuter (40–80L/month usage). For you, estimated additional transport cost: ₹800/month. This also causes a 2–3% rise in food delivery and logistics costs, adding another ₹300–500 indirectly to your monthly expenses.`,
    },
    prepay_50k: {
      scenario: "I prepay ₹50,000 on loan",
      delta: Math.round(p.emi * 0.08),
      result: `Prepaying ₹50,000 on a home/personal loan at ~${ECON.repoRate + 2}% interest saves approximately ₹${Math.round(50000 * (ECON.repoRate + 2) / 100).toLocaleString()} in annual interest. Your EMI stays the same but the tenure reduces — saving you ${fmt(50000 * 0.3)} in total interest over the loan's lifetime. Best done in the first half of the loan.`,
    },
    inflation_8: {
      scenario: "Inflation hits 8%",
      delta: -Math.round(p.expenses * 0.025),
      result: `If CPI rises to 8% from current ${ECON.cpi}%, your effective monthly expense burden increases by ₹${Math.round(p.expenses * 0.025).toLocaleString()} due to costlier groceries, fuel, and services. Your real savings would shrink to ${fmt(net - p.expenses * 0.025)}/month. RBI would likely respond with a 0.25–0.5% rate hike, also increasing floating EMIs.`,
    },
  };

  return { score, headline, summary, xaiFactors, recommendations: recs.slice(0, 5), forecast, whatIfEngine, foresight };
}

// ── Sub-components ────────────────────────────────────────────────────────────
const ScoreRing = ({ score }: { score: number }) => {
  const r = 40; const circ = 2 * Math.PI * r;
  const color = score >= 70 ? "#10b981" : score >= 45 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "Strong" : score >= 45 ? "Moderate" : "At Risk";
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="100" height="100" className="-rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
            strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{score}</span>
          <span className="text-xs font-semibold" style={{ color }}>{label}</span>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-1">Health Score</p>
    </div>
  );
};

const PriorityBadge = ({ p }: { p: "high" | "medium" | "low" }) => {
  const map = { high: "bg-red-100 text-red-600", medium: "bg-amber-100 text-amber-600", low: "bg-green-100 text-green-600" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[p]}`}>{p} priority</span>;
};

const ForecastBar = ({ data }: { data: { month: string; savings: number; cumulative: number }[] }) => {
  const maxCum = Math.max(...data.map(d => d.cumulative), 1);
  const maxSav = Math.max(...data.map(d => Math.abs(d.savings)), 1);
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-8 flex-shrink-0">{d.month}</span>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-2 bg-gray-100 rounded-full flex-1">
                <div className={`h-2 rounded-full ${d.savings >= 0 ? "bg-green-400" : "bg-red-400"}`}
                  style={{ width: `${(Math.abs(d.savings) / maxSav) * 100}%` }} />
              </div>
              <span className={`text-xs font-medium w-20 text-right flex-shrink-0 ${d.savings >= 0 ? "text-green-600" : "text-red-500"}`}>
                {fmt(d.savings)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 bg-gray-100 rounded-full flex-1">
                <div className="h-1.5 bg-indigo-400 rounded-full" style={{ width: `${(d.cumulative / maxCum) * 100}%` }} />
              </div>
              <span className="text-xs text-indigo-500 w-20 text-right flex-shrink-0">{fmt(d.cumulative)}</span>
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-4 text-xs text-gray-400 pt-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Monthly savings</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />Cumulative total</span>
      </div>
    </div>
  );
};

// ── What-If Presets ───────────────────────────────────────────────────────────
const WHATIF_PRESETS = [
  { label: "Expenses rise 10%", key: "expense_up_10", emoji: "📈" },
  { label: "Income drops 20%", key: "income_down_20", emoji: "📉" },
  { label: "Repo rate rises 0.5%", key: "repo_up", emoji: "🏦" },
  { label: "I start ₹5,000 SIP", key: "sip_5k", emoji: "💹" },
  { label: "I lose my job for 3 months", key: "job_loss", emoji: "⚠️" },
  { label: "Petrol price rises ₹10/L", key: "petrol_up", emoji: "⛽" },
  { label: "I prepay ₹50,000 on loan", key: "prepay_50k", emoji: "🏡" },
  { label: "Inflation hits 8%", key: "inflation_8", emoji: "🔥" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
const InsightsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "xai" | "forecast" | "whatif" | "actions">("overview");
  const [selectedWhatIf, setSelectedWhatIf] = useState<string[]>([]);
  const [shownWhatIf, setShownWhatIf] = useState<string[]>([]);
  const [helpful, setHelpful] = useState<boolean | null>(null);

  // Load profile from localStorage (set by My Money + Profile pages)
  const profile: UserProfile = useMemo(() => ({
    name: lsGet("econome_name", ""),
    role: lsGet("econome_role", "salaried"),
    age: parseInt(lsGet("econome_age", "25")) || 25,
    income:
      parseFloat(lsGet("econome_income", "0")) ||
      (lsGet<any[]>("econome_incomes", []) as any[]).reduce((s: number, i: any) => s + (i.amount || 0), 0),
    expenses:
      parseFloat(lsGet("econome_expenses", "0")) ||
      (lsGet<any[]>("econome_expenses_log", []) as any[]).reduce((s: number, e: any) => s + (e.amount || 0), 0),
    savingsGoal: parseFloat(lsGet("econome_savings_goal", "50000")) || 50000,
    emi:
      parseFloat(lsGet("econome_emi", "0")) ||
      (lsGet<any[]>("econome_loans", []) as any[]).reduce((s: number, l: any) => s + (l.emi || 0), 0),
    budgetGoal: lsGet("econome_budget_goal", 30000) || 30000,
  }), []);

  const hasData = profile.income > 0;
  const report = useMemo(() => runAIEngine(profile), [profile]);

  const net = profile.income - profile.expenses - profile.emi;
  const savingsRate = profile.income > 0 ? (net / profile.income) * 100 : 0;

  const TABS = [
    { key: "overview", label: "Overview", emoji: "🧠" },
    { key: "xai", label: "AI Reasoning", emoji: "🔍" },
    { key: "forecast", label: "Forecast", emoji: "📈" },
    { key: "whatif", label: "What-If", emoji: "🔀" },
    { key: "actions", label: "Actions", emoji: "🎯" },
  ] as const;

  const roleLabel: Record<string, string> = {
    student: "Student", salaried: "Salaried Professional",
    business: "Business Owner", homemaker: "Homemaker", retired: "Retiree",
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">💡 Why This Matters To You</h1>
          <p className="text-gray-400 text-sm">
            {roleLabel[profile.role] ?? "Your"} finances × Indian economy · Personalised AI analysis
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          <span className="text-xs text-indigo-600 font-medium">Live Analysis</span>
        </div>
      </div>

      {/* ── No data nudge ── */}
      {!hasData && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800 text-sm">Add your financial data for a personalised report</p>
            <p className="text-amber-700 text-xs mt-1">
              Go to <strong>My Money</strong> to add income & expenses, or fill <strong>Profile → Financial Details</strong>.
              The analysis below uses demo values until your real data is added.
            </p>
          </div>
        </div>
      )}

      {/* ── Score Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-5">
          <ScoreRing score={report.score} />
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-lg leading-snug">{report.headline}</p>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">{report.summary}</p>
            <p className="text-xs text-gray-400 mt-2">
              🤖 AI Engine · Context-Aware · XAI · Foresight · Counterfactual
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400">Monthly Net</p>
            <p className={`font-bold text-lg ${net >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(net)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400">Savings Rate</p>
            <p className={`font-bold text-lg ${savingsRate >= 20 ? "text-green-600" : savingsRate >= 10 ? "text-amber-500" : "text-red-500"}`}>
              {savingsRate.toFixed(1)}%
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400">CPI Impact</p>
            <p className="font-bold text-lg text-amber-500">{ECON.cpi}% / yr</p>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 text-xs px-3 py-2 rounded-lg font-medium transition ${
              activeTab === tab.key ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW ══════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-4">

          {/* Foresight */}
          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🔮</span>
              <div>
                <p className="font-bold text-gray-900 text-sm">AI Foresight</p>
                <p className="text-xs text-gray-400">12-month financial trajectory prediction</p>
              </div>
              <span className="ml-auto text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">Predictive AI</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{report.foresight || "Your financial trajectory looks stable. Continue your current savings discipline and reassess quarterly."}</p>
          </div>

          {/* Live economic context */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="font-bold text-gray-900 text-sm mb-3">📊 Live Economic Context Affecting You</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "USD/INR", value: `₹${ECON.usdInr}`, sub: "Imports costlier → fuel, electronics", color: "text-red-500" },
                { label: "CPI Inflation", value: `${ECON.cpi}%`, sub: `Eroding ₹${Math.round((ECON.cpi / 100) * profile.income / 12).toLocaleString()} real value/month`, color: "text-amber-500" },
                { label: "Repo Rate", value: `${ECON.repoRate}%`, sub: "Sets your loan & FD rates", color: "text-amber-500" },
                { label: "Crude Oil", value: `$${ECON.crude}/bbl`, sub: ECON.crude > 85 ? "Petrol price rise risk" : "Petrol prices stable", color: ECON.crude > 85 ? "text-red-500" : "text-green-600" },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">{item.label}</p>
                  <p className="font-bold text-gray-900">{item.value}</p>
                  <p className={`text-xs ${item.color}`}>{item.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Helpful */}
          <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3">
            <span className="text-xs text-gray-500">Was this insight helpful?</span>
            <button onClick={() => setHelpful(true)}
              className={`text-xs px-3 py-1 rounded-full border transition ${helpful === true ? "bg-green-500 text-white border-green-500" : "border-gray-200 text-gray-500 hover:border-green-400"}`}>
              👍 Yes
            </button>
            <button onClick={() => setHelpful(false)}
              className={`text-xs px-3 py-1 rounded-full border transition ${helpful === false ? "bg-red-400 text-white border-red-400" : "border-gray-200 text-gray-500 hover:border-red-300"}`}>
              👎 No
            </button>
            {helpful !== null && <span className="text-xs text-gray-400">Thanks for the feedback!</span>}
          </div>
        </div>
      )}

      {/* ══ XAI REASONING ════════════════════════════════════════════════════ */}
      {activeTab === "xai" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔍</span>
            <div>
              <p className="font-bold text-gray-900 text-sm">Explainable AI (XAI)</p>
              <p className="text-xs text-gray-400">Transparent reasoning behind your score of {report.score}/100</p>
            </div>
          </div>

          {report.xaiFactors.map((f, i) => (
            <div key={i}>
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${f.direction === "positive" ? "text-green-500" : f.direction === "negative" ? "text-red-500" : "text-amber-500"}`}>
                    {f.direction === "positive" ? "▲" : f.direction === "negative" ? "▼" : "→"}
                  </span>
                  <span className="text-sm font-medium text-gray-800">{f.label}</span>
                </div>
                <span className="text-xs font-mono text-gray-400">{(f.weight * 100).toFixed(0)}% weight</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full mb-1.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all ${f.direction === "positive" ? "bg-green-400" : f.direction === "negative" ? "bg-red-400" : "bg-amber-400"}`}
                  style={{ width: `${f.weight * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">{f.explanation}</p>
            </div>
          ))}

          <div className="bg-indigo-50 rounded-xl p-4 text-xs text-indigo-700 mt-2">
            <p className="font-semibold mb-1">How XAI works in EconoMe</p>
            <p>Each factor is weighted by how much it influences your financial health score. Weights sum to 100%. The AI considers your exact income, expenses, EMI, and live economic data — not generic benchmarks. This mirrors how a certified financial planner (CFP) would evaluate your profile.</p>
          </div>
        </div>
      )}

      {/* ══ FORECAST ═════════════════════════════════════════════════════════ */}
      {activeTab === "forecast" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">📈</span>
            <div>
              <p className="font-bold text-gray-900 text-sm">6-Month Savings Forecast</p>
              <p className="text-xs text-gray-400">AI Foresight model · accounts for {ECON.cpi}% inflation trend</p>
            </div>
          </div>

          <ForecastBar data={report.forecast} />

          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">Projected 6-month savings</p>
              <p className="font-bold text-green-600 text-lg">{fmt(report.forecast[5]?.cumulative ?? 0)}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">Inflation will erode</p>
              <p className="font-bold text-amber-600 text-lg">
                {fmt(Math.round((ECON.cpi / 100) * profile.income / 2))}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600">
            <p className="font-medium text-gray-700 mb-1">📌 Forecast Assumptions</p>
            <p>Income ₹{fmt(profile.income)} stable · Expenses grow with {ECON.cpi}% CPI · EMI ₹{fmt(profile.emi)} constant · No new loans or large one-time expenses modelled.</p>
          </div>
        </div>
      )}

      {/* ══ WHAT-IF ═══════════════════════════════════════════════════════════ */}
      {activeTab === "whatif" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🔀</span>
              <div>
                <p className="font-bold text-gray-900 text-sm">Counterfactual Analysis</p>
                <p className="text-xs text-gray-400">Tap scenarios to instantly see their impact on your finances</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {WHATIF_PRESETS.map(p => (
                <button key={p.key}
                  onClick={() => {
                    setSelectedWhatIf(prev =>
                      prev.includes(p.key) ? prev.filter(k => k !== p.key) : [...prev, p.key]
                    );
                  }}
                  className={`text-xs text-left px-3 py-2.5 rounded-xl border transition flex items-center gap-2 ${
                    selectedWhatIf.includes(p.key)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300"
                  }`}>
                  <span>{p.emoji}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>

            {selectedWhatIf.length > 0 && (
              <button
                onClick={() => setShownWhatIf([...selectedWhatIf])}
                className="mt-3 w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700"
              >
                Analyse {selectedWhatIf.length} scenario{selectedWhatIf.length > 1 ? "s" : ""} →
              </button>
            )}
          </div>

          {/* Results — instant, no loading */}
          {shownWhatIf.length > 0 && (
            <div className="space-y-3">
              {shownWhatIf.map(key => {
                const r = report.whatIfEngine[key];
                if (!r) return null;
                return (
                  <div key={key} className={`bg-white rounded-2xl border shadow-sm p-4 ${r.delta >= 0 ? "border-green-100" : "border-red-100"}`}>
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-semibold text-gray-900 text-sm">{r.scenario}</p>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <span className={`text-sm font-bold ${r.delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {r.delta >= 0 ? "+" : ""}{fmt(r.delta)}/mo
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{r.result}</p>
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${r.delta >= 0 ? "bg-green-400" : "bg-red-400"}`}
                        style={{ width: `${Math.min(100, Math.abs(r.delta) / Math.max(1, profile.income) * 300)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* XAI note */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-700">
            <p className="font-semibold mb-1">🤖 About Counterfactual Analysis</p>
            <p>Each scenario is calculated using your actual income (₹{fmt(profile.income)}), expenses (₹{fmt(profile.expenses)}), and EMI (₹{fmt(profile.emi)}) combined with live economic data. Results show the estimated monthly impact on your net savings.</p>
          </div>
        </div>
      )}

      {/* ══ ACTIONS ═══════════════════════════════════════════════════════════ */}
      {activeTab === "actions" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🎯</span>
            <div>
              <p className="font-bold text-gray-900 text-sm">AI Action Plan</p>
              <p className="text-xs text-gray-400">Personalised for {roleLabel[profile.role] ?? "you"} · age {profile.age}</p>
            </div>
          </div>

          {report.recommendations.map((rec, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex justify-between items-start mb-2 gap-2">
                <p className="font-semibold text-gray-900 text-sm">{rec.title}</p>
                <PriorityBadge p={rec.priority} />
              </div>
              <p className="text-sm text-gray-700 leading-relaxed mb-2">{rec.action}</p>
              <div className="bg-green-50 rounded-lg px-3 py-1.5 flex items-center gap-2">
                <span className="text-green-600 text-xs font-medium">💚 Impact:</span>
                <span className="text-xs text-green-700">{rec.impact}</span>
              </div>
            </div>
          ))}

          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs text-gray-500">
            <p className="font-medium text-gray-600 mb-1">⚖️ Disclaimer</p>
            <p>These recommendations are generated by AI based on your profile data and are for educational purposes only. Consult a SEBI-registered investment advisor before making financial decisions.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsightsPage;
