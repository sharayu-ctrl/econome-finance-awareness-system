import React, { useState, useEffect } from "react";
import { useFinanceSummary, useAddExpense, useAddIncome } from "../lib/api";

// ── i18n ──────────────────────────────────────────────────────────────────────
const LANGS = { en: "English", hi: "हिंदी", mr: "मराठी" } as const;
type Lang = keyof typeof LANGS;

const T: Record<Lang, Record<string, string>> = {
  en: {
    title: "💰 Your Money Today",
    subtitle: "Personal finance tracker",
    income: "Monthly Income",
    addIncome: "Add Income",
    expenses: "Expenses This Month",
    addExpense: "Add Expense",
    savings: "Savings Status",
    saved: "Saved",
    goal: "Goal",
    loans: "Active Loans",
    emi: "EMI/month",
    noLoan: "No active loan",
    budget: "Budgeting Goal",
    budgetStatus: "Budget Status",
    spent: "Spent",
    remaining: "Remaining",
    onTrack: "🟢 On Track",
    warning: "🟡 Needs Attention",
    critical: "🔴 Critical",
    source: "Source",
    amount: "Amount (₹)",
    description: "Description",
    category: "Category",
    cancel: "Cancel",
    save: "Save",
    edit: "Edit",
    remove: "Remove",
    loanType: "Loan Type",
    addLoan: "Add Loan",
    emiCount: "EMIs remaining",
    budgetGoal: "Monthly Budget (₹)",
    setBudget: "Set Budget",
    netSavings: "Net Savings",
  },
  hi: {
    title: "💰 आपका आज का पैसा",
    subtitle: "व्यक्तिगत वित्त ट्रैकर",
    income: "मासिक आय",
    addIncome: "आय जोड़ें",
    expenses: "इस महीने के खर्च",
    addExpense: "खर्च जोड़ें",
    savings: "बचत स्थिति",
    saved: "बचाया",
    goal: "लक्ष्य",
    loans: "सक्रिय ऋण",
    emi: "EMI/माह",
    noLoan: "कोई सक्रिय ऋण नहीं",
    budget: "बजट लक्ष्य",
    budgetStatus: "बजट स्थिति",
    spent: "खर्च",
    remaining: "शेष",
    onTrack: "🟢 सही रास्ते पर",
    warning: "🟡 ध्यान चाहिए",
    critical: "🔴 गंभीर",
    source: "स्रोत",
    amount: "राशि (₹)",
    description: "विवरण",
    category: "श्रेणी",
    cancel: "रद्द करें",
    save: "सहेजें",
    edit: "संपादित",
    remove: "हटाएं",
    loanType: "ऋण प्रकार",
    addLoan: "ऋण जोड़ें",
    emiCount: "शेष EMI",
    budgetGoal: "मासिक बजट (₹)",
    setBudget: "बजट सेट करें",
    netSavings: "शुद्ध बचत",
  },
  mr: {
    title: "💰 आजचे तुमचे पैसे",
    subtitle: "वैयक्तिक वित्त ट्रॅकर",
    income: "मासिक उत्पन्न",
    addIncome: "उत्पन्न जोडा",
    expenses: "या महिन्याचे खर्च",
    addExpense: "खर्च जोडा",
    savings: "बचत स्थिती",
    saved: "जमा",
    goal: "ध्येय",
    loans: "सक्रिय कर्जे",
    emi: "EMI/महिना",
    noLoan: "कोणतेही सक्रिय कर्ज नाही",
    budget: "बजेट ध्येय",
    budgetStatus: "बजेट स्थिती",
    spent: "खर्च",
    remaining: "शिल्लक",
    onTrack: "🟢 योग्य मार्गावर",
    warning: "🟡 लक्ष द्या",
    critical: "🔴 गंभीर",
    source: "स्रोत",
    amount: "रक्कम (₹)",
    description: "वर्णन",
    category: "श्रेणी",
    cancel: "रद्द करा",
    save: "जतन करा",
    edit: "संपादित",
    remove: "काढा",
    loanType: "कर्जाचा प्रकार",
    addLoan: "कर्ज जोडा",
    emiCount: "उर्वरित EMI",
    budgetGoal: "मासिक बजेट (₹)",
    setBudget: "बजेट सेट करा",
    netSavings: "निव्वळ बचत",
  },
};

const fmt = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`;

type Expense = { id: string; description: string; amount: number; category: string; date: string };
type Income = { id: string; source: string; amount: number; date: string };
type Loan = { id: string; type: string; emi: number; emisRemaining: number };

const INCOME_SOURCES = ["Salary", "Freelance", "Business", "Rental Income", "Investment Returns", "Other"];
const EXPENSE_CATEGORIES = ["Food", "Transport", "Medical", "Utilities", "Entertainment", "Education", "Rent", "Other"];
const LOAN_TYPES = ["Education Loan", "Home Loan", "Car Loan", "Personal Loan"];

// ── Local storage helpers ──────────────────────────────────────────────────────
const lsGet = <T,>(key: string, def: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || "") ?? def; } catch { return def; }
};
const lsSet = (key: string, val: unknown) => localStorage.setItem(key, JSON.stringify(val));

// ── Modal helpers ──────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-900">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
      </div>
      {children}
    </div>
  </div>
);

// ── Main Page ──────────────────────────────────────────────────────────────────
const MoneyPage: React.FC = () => {
  const [lang, setLang] = useState<Lang>(() => (lsGet("econome_lang", "en") as Lang));
  const t = T[lang];

  // Persist language
  useEffect(() => { lsSet("econome_lang", lang); }, [lang]);

  const { data, isLoading } = useFinanceSummary();
  const addExpenseApi = useAddExpense();
  const addIncomeApi = useAddIncome();

  // Local state (persisted in localStorage)
  const [incomes, setIncomes] = useState<Income[]>(() => lsGet("econome_incomes", []));
  const [expenses, setExpenses] = useState<Expense[]>(() => lsGet("econome_expenses_log", []));
  const [loans, setLoans] = useState<Loan[]>(() => lsGet("econome_loans", []));
  const [budgetGoal, setBudgetGoal] = useState<number>(() => lsGet("econome_budget_goal", 30000));
  const [savingsGoal, setSavingsGoal] = useState<number>(() => lsGet("econome_savings_goal", 50000));

  // Modals
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [showBudgetEdit, setShowBudgetEdit] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

  // Form state
  const [incomeForm, setIncomeForm] = useState({ source: "", amount: "" });
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "", category: "" });
  const [loanForm, setLoanForm] = useState({ type: "", emi: "", emisRemaining: "" });
  const [budgetForm, setBudgetForm] = useState(String(budgetGoal));
  const [savingsGoalForm, setSavingsGoalForm] = useState(String(savingsGoal));

  // Derived totals
  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0) || (data?.total_income ?? 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0) || (data?.total_expense ?? 0);
  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? netSavings / totalIncome : 0;
  const savingsProgress = savingsGoal > 0 ? Math.min(100, (netSavings / savingsGoal) * 100) : 0;
  const budgetProgress = budgetGoal > 0 ? Math.min(100, (totalExpense / budgetGoal) * 100) : 0;
  const budgetRemaining = budgetGoal - totalExpense;

  const savingsBadge = savingsRate >= 0.2 ? t.onTrack : savingsRate >= 0.1 ? t.warning : t.critical;
  const budgetBadge = budgetProgress < 70 ? t.onTrack : budgetProgress < 90 ? t.warning : t.critical;

  // Persist changes
  useEffect(() => { lsSet("econome_incomes", incomes); }, [incomes]);
  useEffect(() => { lsSet("econome_expenses_log", expenses); }, [expenses]);
  useEffect(() => { lsSet("econome_loans", loans); }, [loans]);
  useEffect(() => { lsSet("econome_budget_goal", budgetGoal); }, [budgetGoal]);
  useEffect(() => { lsSet("econome_savings_goal", savingsGoal); }, [savingsGoal]);

  const genId = () => Math.random().toString(36).slice(2);
  const today = () => new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  // Income CRUD
  const handleSaveIncome = () => {
    if (!incomeForm.amount) return;
    const entry: Income = {
      id: editingIncome?.id || genId(),
      source: incomeForm.source || "Other",
      amount: parseFloat(incomeForm.amount),
      date: today(),
    };
    if (editingIncome) {
      setIncomes(prev => prev.map(i => i.id === editingIncome.id ? entry : i));
    } else {
      setIncomes(prev => [...prev, entry]);
      addIncomeApi.mutate({ amount: entry.amount, source: entry.source });
    }
    setIncomeForm({ source: "", amount: "" });
    setShowAddIncome(false);
    setEditingIncome(null);
  };

  // Expense CRUD
  const handleSaveExpense = () => {
    if (!expenseForm.amount) return;
    const entry: Expense = {
      id: editingExpense?.id || genId(),
      description: expenseForm.description || expenseForm.category,
      amount: parseFloat(expenseForm.amount),
      category: expenseForm.category || "Other",
      date: today(),
    };
    if (editingExpense) {
      setExpenses(prev => prev.map(e => e.id === editingExpense.id ? entry : e));
    } else {
      setExpenses(prev => [...prev, entry]);
      addExpenseApi.mutate({ raw_text: entry.description, amount: entry.amount });
    }
    setExpenseForm({ description: "", amount: "", category: "" });
    setShowAddExpense(false);
    setEditingExpense(null);
  };

  // Loan CRUD
  const handleSaveLoan = () => {
    if (!loanForm.type || !loanForm.emi) return;
    const entry: Loan = {
      id: editingLoan?.id || genId(),
      type: loanForm.type,
      emi: parseFloat(loanForm.emi),
      emisRemaining: parseInt(loanForm.emisRemaining) || 0,
    };
    if (editingLoan) {
      setLoans(prev => prev.map(l => l.id === editingLoan.id ? entry : l));
    } else {
      setLoans(prev => [...prev, entry]);
    }
    setLoanForm({ type: "", emi: "", emisRemaining: "" });
    setShowAddLoan(false);
    setEditingLoan(null);
  };

  const openEditIncome = (i: Income) => {
    setIncomeForm({ source: i.source, amount: String(i.amount) });
    setEditingIncome(i);
    setShowAddIncome(true);
  };
  const openEditExpense = (e: Expense) => {
    setExpenseForm({ description: e.description, amount: String(e.amount), category: e.category });
    setEditingExpense(e);
    setShowAddExpense(true);
  };
  const openEditLoan = (l: Loan) => {
    setLoanForm({ type: l.type, emi: String(l.emi), emisRemaining: String(l.emisRemaining) });
    setEditingLoan(l);
    setShowAddLoan(true);
  };

  const totalEmi = loans.reduce((s, l) => s + l.emi, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
          <p className="text-sm text-gray-400">{t.subtitle} · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long" })}</p>
        </div>
        {/* Language toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(Object.keys(LANGS) as Lang[]).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${lang === l ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {LANGS[l]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">{t.income}</p>
          <p className="font-bold text-green-600 text-lg">{fmt(totalIncome)}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">{t.expenses}</p>
          <p className="font-bold text-red-500 text-lg">{fmt(totalExpense)}</p>
        </div>
        <div className="bg-indigo-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">{t.netSavings}</p>
          <p className={`font-bold text-lg ${netSavings >= 0 ? "text-indigo-600" : "text-red-500"}`}>{fmt(Math.abs(netSavings))}</p>
        </div>
      </div>

      {/* ── Section 1: Monthly Income ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-gray-900">💵 {t.income}</h2>
          <button onClick={() => { setEditingIncome(null); setIncomeForm({ source: "", amount: "" }); setShowAddIncome(true); }}
            className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-100 font-medium">
            + {t.addIncome}
          </button>
        </div>
        {incomes.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">No income added yet</p>
        ) : (
          <div className="space-y-2">
            {incomes.map(i => (
              <div key={i.id} className="flex justify-between items-center text-sm bg-gray-50 rounded-lg px-3 py-2">
                <div>
                  <span className="font-medium text-gray-700">{i.source}</span>
                  <span className="text-xs text-gray-400 ml-2">{i.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-green-600">{fmt(i.amount)}</span>
                  <button onClick={() => openEditIncome(i)} className="text-xs text-indigo-400 hover:text-indigo-600">✏️</button>
                  <button onClick={() => setIncomes(prev => prev.filter(x => x.id !== i.id))} className="text-xs text-red-300 hover:text-red-500">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: Expenses Log ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-gray-900">💸 {t.expenses}</h2>
          <button onClick={() => { setEditingExpense(null); setExpenseForm({ description: "", amount: "", category: "" }); setShowAddExpense(true); }}
            className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 font-medium">
            + {t.addExpense}
          </button>
        </div>
        {expenses.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">No expenses logged yet</p>
        ) : (
          <div className="space-y-2">
            {expenses.map(e => (
              <div key={e.id} className="flex justify-between items-center text-sm bg-gray-50 rounded-lg px-3 py-2">
                <div>
                  <span className="font-medium text-gray-700">{e.description || e.category}</span>
                  <span className="text-xs text-gray-400 ml-2">{e.category} · {e.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-500">{fmt(e.amount)}</span>
                  <button onClick={() => openEditExpense(e)} className="text-xs text-indigo-400 hover:text-indigo-600">✏️</button>
                  <button onClick={() => setExpenses(prev => prev.filter(x => x.id !== e.id))} className="text-xs text-red-300 hover:text-red-500">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 3: Savings Status ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-gray-900">🏦 {t.savings}</h2>
          <span className="text-xs font-medium">{savingsBadge}</span>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t.saved}</span>
            <span className="font-bold text-indigo-600">{fmt(netSavings)}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-gray-500">{t.goal}</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700">{fmt(savingsGoal)}</span>
              <button onClick={() => { setSavingsGoalForm(String(savingsGoal)); setShowBudgetEdit(true); }}
                className="text-xs text-indigo-400 hover:text-indigo-600">✏️</button>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{Math.round(savingsProgress)}% of goal</span>
              <span>{fmt(netSavings)} / {fmt(savingsGoal)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full">
              <div className={`h-2 rounded-full transition-all ${savingsProgress >= 80 ? "bg-green-500" : savingsProgress >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                style={{ width: `${savingsProgress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 4: Active Loans ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-gray-900">🏦 {t.loans}</h2>
          <button onClick={() => { setEditingLoan(null); setLoanForm({ type: "", emi: "", emisRemaining: "" }); setShowAddLoan(true); }}
            className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-medium">
            + {t.addLoan}
          </button>
        </div>
        {loans.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">{t.noLoan}</p>
        ) : (
          <>
            <div className="space-y-2 mb-3">
              {loans.map(l => (
                <div key={l.id} className="flex justify-between items-center text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-medium text-gray-700">{l.type}</span>
                    {l.emisRemaining > 0 && (
                      <span className="text-xs text-gray-400 ml-2">{l.emisRemaining} {t.emiCount}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">{fmt(l.emi)} {t.emi}</span>
                    <button onClick={() => openEditLoan(l)} className="text-xs text-indigo-400 hover:text-indigo-600">✏️</button>
                    <button onClick={() => setLoans(prev => prev.filter(x => x.id !== l.id))} className="text-xs text-red-300 hover:text-red-500">🗑</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-indigo-50 rounded-xl px-3 py-2 text-sm flex justify-between">
              <span className="text-indigo-700 font-medium">Total EMI/month</span>
              <span className="font-bold text-indigo-700">{fmt(totalEmi)}</span>
            </div>
          </>
        )}
      </div>

      {/* ── Section 5: Budgeting Goal ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-gray-900">🎯 {t.budget}</h2>
          <span className="text-xs font-medium">{budgetBadge}</span>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm items-center">
            <span className="text-gray-500">{t.budgetGoal}</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700">{fmt(budgetGoal)}</span>
              <button onClick={() => { setBudgetForm(String(budgetGoal)); setShowBudgetEdit(true); }}
                className="text-xs text-indigo-400 hover:text-indigo-600">✏️</button>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t.spent}</span>
            <span className="font-semibold text-red-500">{fmt(totalExpense)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t.remaining}</span>
            <span className={`font-semibold ${budgetRemaining >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(Math.abs(budgetRemaining))}</span>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{Math.round(budgetProgress)}% used</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full">
              <div className={`h-2 rounded-full transition-all ${budgetProgress < 70 ? "bg-green-500" : budgetProgress < 90 ? "bg-amber-400" : "bg-red-500"}`}
                style={{ width: `${budgetProgress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────── */}

      {/* Add/Edit Income */}
      {showAddIncome && (
        <Modal title={editingIncome ? `${t.edit} ${t.income}` : t.addIncome} onClose={() => { setShowAddIncome(false); setEditingIncome(null); }}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.source}</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-200"
                value={incomeForm.source} onChange={e => setIncomeForm({ ...incomeForm, source: e.target.value })}>
                <option value="">Select source</option>
                {INCOME_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.amount}</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
                placeholder="e.g. 35000" value={incomeForm.amount} onChange={e => setIncomeForm({ ...incomeForm, amount: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowAddIncome(false); setEditingIncome(null); }}
                className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">{t.cancel}</button>
              <button onClick={handleSaveIncome} disabled={!incomeForm.amount}
                className="flex-1 bg-green-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-600 disabled:opacity-50">{t.save}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add/Edit Expense */}
      {showAddExpense && (
        <Modal title={editingExpense ? `${t.edit} ${t.expenses}` : t.addExpense} onClose={() => { setShowAddExpense(false); setEditingExpense(null); }}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.description}</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                placeholder='e.g. "Swiggy order"' value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.category}</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200"
                value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                <option value="">Select category</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.amount}</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                placeholder="e.g. 450" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowAddExpense(false); setEditingExpense(null); }}
                className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">{t.cancel}</button>
              <button onClick={handleSaveExpense} disabled={!expenseForm.amount}
                className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-600 disabled:opacity-50">{t.save}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add/Edit Loan */}
      {showAddLoan && (
        <Modal title={editingLoan ? `${t.edit} ${t.loans}` : t.addLoan} onClose={() => { setShowAddLoan(false); setEditingLoan(null); }}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.loanType}</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={loanForm.type} onChange={e => setLoanForm({ ...loanForm, type: e.target.value })}>
                <option value="">Select type</option>
                {LOAN_TYPES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.emi}</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="e.g. 3200" value={loanForm.emi} onChange={e => setLoanForm({ ...loanForm, emi: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.emiCount}</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="e.g. 24" value={loanForm.emisRemaining} onChange={e => setLoanForm({ ...loanForm, emisRemaining: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowAddLoan(false); setEditingLoan(null); }}
                className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">{t.cancel}</button>
              <button onClick={handleSaveLoan} disabled={!loanForm.type || !loanForm.emi}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{t.save}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Budget/Savings Goal Editor */}
      {showBudgetEdit && (
        <Modal title="Set Goals" onClose={() => setShowBudgetEdit(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.budgetGoal}</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={budgetForm} onChange={e => setBudgetForm(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Savings Goal (₹)</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={savingsGoalForm} onChange={e => setSavingsGoalForm(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowBudgetEdit(false)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">{t.cancel}</button>
              <button onClick={() => { setBudgetGoal(parseFloat(budgetForm) || budgetGoal); setSavingsGoal(parseFloat(savingsGoalForm) || savingsGoal); setShowBudgetEdit(false); }}
                className="flex-1 bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700">{t.setBudget}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MoneyPage;
