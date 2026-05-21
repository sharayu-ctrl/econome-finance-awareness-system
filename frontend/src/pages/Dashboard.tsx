import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useFinanceSummary } from "../lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`;

const lsGet = <T,>(key: string, def: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || "") ?? def; } catch { return def; }
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// ── Live economic snapshot ────────────────────────────────────────────────────
const ECON = { usdInr: 83.62, cpi: 5.4, repoRate: 6.5, crude: 82.4, nifty: 22530 };

// ── Health Score Engine ───────────────────────────────────────────────────────
function computeHealthScore(income: number, expenses: number, emi: number, budgetGoal: number) {
  const net = income - expenses - emi;
  const savingsRate = income > 0 ? (net / income) * 100 : 0;
  const emiRatio = income > 0 ? (emi / income) * 100 : 0;
  const budgetUtil = budgetGoal > 0 ? (expenses / budgetGoal) * 100 : 100;

  let score = 50;
  score += clamp(savingsRate * 1.2, -25, 25);
  score -= clamp(emiRatio * 0.6, 0, 20);
  score -= clamp((budgetUtil - 80) * 0.4, 0, 15);
  score -= clamp(ECON.cpi * 1.5, 0, 10);
  score = Math.round(clamp(score, 5, 98));

  const debtScore = Math.round(clamp(100 - emiRatio * 1.5, 20, 95));
  const investScore = Math.round(clamp(50 + savingsRate * 1.5, 20, 92));

  return { score, savingsRate, debtScore, investScore };
}

// ── Score Ring ────────────────────────────────────────────────────────────────
const ScoreRing = ({ score }: { score: number }) => {
  const r = 56;
  const circ = 2 * Math.PI * r;
  const color = score >= 70 ? "#f59e0b" : score >= 45 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "Good" : score >= 45 ? "Moderate" : "At Risk";
  const labelColor = score >= 70 ? "#f59e0b" : score >= 45 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 140, height: 140 }}>
        <svg width="140" height="140" className="-rotate-90" style={{ position: "absolute" }}>
          <circle cx="70" cy="70" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - score / 100)}
            strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-gray-900">{score}</span>
          <span className="text-sm text-gray-400">/100</span>
        </div>
      </div>
      <span className="text-lg font-bold mt-1" style={{ color: labelColor }}>{label}</span>
    </div>
  );
};

// ── Score Bar ─────────────────────────────────────────────────────────────────
const ScoreBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div>
    <div className="flex justify-between text-sm mb-1">
      <span className="text-gray-700 font-medium">{label}</span>
      <span className="text-gray-500">{value}%</span>
    </div>
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
    </div>
  </div>
);

// ── Financial Health Score Card (LEFT BIG CARD) ───────────────────────────────
const HealthScoreCard = ({ income, expenses, emi, budgetGoal }: {
  income: number; expenses: number; emi: number; budgetGoal: number;
}) => {
  const { score, savingsRate, debtScore, investScore } = computeHealthScore(income, expenses, emi, budgetGoal);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-gray-900">Financial Health Score</h2>
        <span className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full font-medium">
          ✦ AI
        </span>
      </div>

      <div className="flex justify-center">
        <ScoreRing score={score} />
      </div>

      <div className="space-y-4">
        <ScoreBar label="Savings Rate" value={Math.round(clamp(savingsRate * 4, 0, 100))} color="bg-green-500" />
        <ScoreBar label="Debt Management" value={debtScore} color="bg-indigo-500" />
        <ScoreBar label="Investment Score" value={investScore} color="bg-gray-900" />
      </div>
    </div>
  );
};

// ── Your Money Today Card ─────────────────────────────────────────────────────
const MoneyTodayCard = ({ income, expenses, emi }: { income: number; expenses: number; emi: number }) => {
  const navigate = useNavigate();
  const net = income - expenses - emi;
  const incomeChange = "+12.5%"; // indicative
  const expenseChange = "+4.2%";

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:border-indigo-200 hover:shadow-md transition"
      onClick={() => navigate("/money")}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-lg">💰</div>
        <div>
          <p className="font-bold text-gray-900 text-sm">Your Money Today</p>
          <p className="text-xs text-gray-400">Income, expenses & savings at a glance</p>
        </div>
        <span className="ml-auto text-gray-300 text-lg">↗</span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-400">Monthly Income</p>
            <p className="font-bold text-gray-900 text-lg">{fmt(income)}</p>
          </div>
          <span className="text-xs text-green-500 font-semibold">↗ {incomeChange}</span>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-400">Total Expenses</p>
            <p className="font-bold text-gray-900 text-lg">{fmt(expenses)}</p>
          </div>
          <span className="text-xs text-red-500 font-semibold">↘ {expenseChange}</span>
        </div>

        <div className="bg-green-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-0.5">Net Savings</p>
          <p className={`font-bold text-2xl ${net >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(net)}</p>
        </div>
      </div>
    </div>
  );
};

// ── Economy Today Card ────────────────────────────────────────────────────────
const EconomyTodayCard = () => {
  const navigate = useNavigate();

  const indicators = [
    { label: "Nifty 50", value: ECON.nifty.toLocaleString("en-IN"), change: "+0.87%", up: true },
    { label: "USD / INR", value: `₹${ECON.usdInr}`, change: "-0.12%", up: false },
    { label: "Crude Oil", value: `$${ECON.crude}/bbl`, change: "+2.41%", up: true },
    { label: "CPI Inflation", value: `${ECON.cpi}%`, change: `${ECON.cpi}%`, up: false },
  ];

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:border-indigo-200 hover:shadow-md transition"
      onClick={() => navigate("/economy")}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-lg">📈</div>
        <div>
          <p className="font-bold text-gray-900 text-sm">Economy Today</p>
          <p className="text-xs text-gray-400">Markets, rates & trends</p>
        </div>
        <span className="ml-auto text-gray-300 text-lg">↗</span>
      </div>

      <div className="space-y-2.5">
        {indicators.map(ind => (
          <div key={ind.label} className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{ind.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-800">{ind.value}</span>
              <span className={`text-xs font-semibold ${ind.up ? "text-green-500" : "text-red-500"}`}>
                {ind.up ? "↗" : "↘"} {ind.change}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Why This Matters Card ─────────────────────────────────────────────────────
const WhyThisMattersCard = ({ income, expenses, emi }: { income: number; expenses: number; emi: number }) => {
  const navigate = useNavigate();
  const net = income - expenses - emi;
  const emiRatio = income > 0 ? (emi / income) * 100 : 0;
  const savingsRate = income > 0 ? (net / income) * 100 : 0;

  // Deterministic insight based on their data
  const insight = useMemo(() => {
    if (income === 0) return {
      tag: "Rate Hike Impact",
      text: "Add your income and expenses to get a personalised insight on how the economy affects your finances.",
    };
    if (emiRatio > 35) return {
      tag: "EMI Pressure",
      text: `Your EMI is ${emiRatio.toFixed(0)}% of income — above the safe 35% threshold. With RBI repo rate at ${ECON.repoRate}%, floating-rate loans are under pressure. Consider prepaying to reduce interest burden.`,
    };
    if (ECON.cpi > 5 && savingsRate < 20) return {
      tag: "Inflation Alert",
      text: `At ${ECON.cpi}% CPI inflation and only ${savingsRate.toFixed(1)}% savings rate, your real purchasing power is shrinking. Consider moving idle savings to a liquid mutual fund earning 6–7% to at least partially offset inflation.`,
    };
    if (savingsRate >= 20) return {
      tag: "Strong Position",
      text: `Your ${savingsRate.toFixed(1)}% savings rate is well above the 20% benchmark. With Nifty at ${ECON.nifty.toLocaleString("en-IN")}, your SIP investments are in a favourable market environment. Stay consistent.`,
    };
    return {
      tag: "Rate Hike Impact",
      text: `The RBI has held the repo rate at ${ECON.repoRate}%. Your variable-rate student and personal loans remain stable for now, but CPI at ${ECON.cpi}% means groceries and transport costs continue rising.`,
    };
  }, [income, expenses, emi]);

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:border-indigo-200 hover:shadow-md transition"
      onClick={() => navigate("/insights")}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-lg">💡</div>
        <div>
          <p className="font-bold text-gray-900 text-sm">Why This Matters</p>
          <p className="text-xs text-gray-400">Impact on your financial goals</p>
        </div>
        <span className="ml-auto text-gray-300 text-lg">↗</span>
      </div>

      <span className="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full font-medium mb-3">
        ✦ AI Insight
      </span>

      <div className="bg-indigo-50 rounded-xl p-3">
        <p className="text-xs font-semibold text-indigo-800 mb-1">{insight.tag}</p>
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{insight.text}</p>
      </div>

      <p className="text-xs text-indigo-500 mt-2 font-medium">View full AI report →</p>
    </div>
  );
};

// ── Learn Something Today Card ────────────────────────────────────────────────
const LearnTodayCard = () => {
  const navigate = useNavigate();
  const role = lsGet("econome_role", "salaried");
  const completedLessons = lsGet<string[]>("econome_completed_lessons", []);
  const xp = lsGet("econome_xp", 0);

  const lessonsByRole: Record<string, { title: string; tag: string }> = {
    student: { title: "The 50/30/20 Rule for Students", tag: "Budgeting" },
    salaried: { title: "Section 80C: Save ₹1.5 Lakh Tax-Free", tag: "Tax Saving" },
    business: { title: "GST Input Tax Credit Explained", tag: "GST" },
    homemaker: { title: "Smart Grocery Shopping: Save ₹2,000/Month", tag: "Budgeting" },
    retired: { title: "Senior Citizens Savings Scheme (SCSS)", tag: "Retirement" },
  };

  const lesson = lessonsByRole[role] ?? lessonsByRole["salaried"];

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:border-indigo-200 hover:shadow-md transition"
      onClick={() => navigate("/learn")}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-lg">🎓</div>
        <div>
          <p className="font-bold text-gray-900 text-sm">Learn Something Today</p>
          <p className="text-xs text-gray-400">Level up your money game</p>
        </div>
        <span className="ml-auto text-gray-300 text-lg">↗</span>
      </div>

      <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-start">
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm">{lesson.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{lesson.tag}</p>
        </div>
        <span className="text-gray-300 text-lg ml-2">↗</span>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
        <span>🔥 {completedLessons.length} lessons done</span>
        <span className="text-indigo-600 font-semibold">{xp} XP</span>
      </div>
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = localStorage.getItem("econome_name")?.split(" ")[0] || "";

  const { data } = useFinanceSummary();

  // Pull income/expenses from API or localStorage fallback
  const income =
    (data?.total_income ?? 0) ||
    parseFloat(lsGet("econome_income", "0")) ||
    (lsGet<any[]>("econome_incomes", []) as any[]).reduce((s: number, i: any) => s + (i.amount || 0), 0);

  const expenses =
    (data?.total_expense ?? 0) ||
    parseFloat(lsGet("econome_expenses", "0")) ||
    (lsGet<any[]>("econome_expenses_log", []) as any[]).reduce((s: number, e: any) => s + (e.amount || 0), 0);

  const emi =
    parseFloat(lsGet("econome_emi", "0")) ||
    (lsGet<any[]>("econome_loans", []) as any[]).reduce((s: number, l: any) => s + (l.emi || 0), 0);

  const budgetGoal = lsGet("econome_budget_goal", 30000);

  return (
    <div>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}{name ? `, ${name}` : ""} 👋
        </h1>
        <p className="text-gray-400 text-sm">Here's your financial pulse</p>
      </div>

      {/* Dashboard Grid — matches screenshot layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT: Financial Health Score (tall card, spans 2 rows) */}
        <div className="lg:row-span-2">
          <HealthScoreCard
            income={income}
            expenses={expenses}
            emi={emi}
            budgetGoal={budgetGoal}
          />
        </div>

        {/* TOP RIGHT: Your Money Today */}
        <MoneyTodayCard income={income} expenses={expenses} emi={emi} />

        {/* TOP RIGHT: Economy Today */}
        <EconomyTodayCard />

        {/* BOTTOM RIGHT: Why This Matters */}
        <WhyThisMattersCard income={income} expenses={expenses} emi={emi} />

        {/* BOTTOM RIGHT: Learn Something Today */}
        <LearnTodayCard />
      </div>
    </div>
  );
};

export default Dashboard;
