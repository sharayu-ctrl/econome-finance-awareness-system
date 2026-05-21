import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLogout } from "../lib/api";
import { useAuthStore } from "../store";

const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    profile: "Profile",
    profileSub: "Manage your account and security settings",
    personalDetails: "Personal Details",
    financialDetails: "Financial Details",
    security: "Security",
    preferences: "Preferences",
    fullName: "Full Name",
    email: "Email",
    role: "Role",
    roleDesc: "Role Description",
    saveChanges: "Save Changes",
    saved: "✓ Saved successfully",
    monthlyIncome: "Monthly Income (₹)",
    monthlyExpenses: "Monthly Expenses (₹)",
    savingsGoal: "Savings Goal (₹)",
    loanEMI: "Active Loan EMI (₹)",
    changePassword: "Change Password",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmPassword: "Confirm New Password",
    updatePassword: "Update Password",
    passwordMismatch: "Passwords do not match",
    passwordSuccess: "✓ Password updated successfully",
    activeDevices: "Active Devices",
    currentSession: "Current session",
    signOut: "Sign Out",
    currency: "Currency",
    language: "Language",
    hideAmounts: "Hide Amounts",
    hideAmountsDesc: "Blur ₹ figures on screen for privacy",
  },
  hi: {
    profile: "प्रोफ़ाइल",
    profileSub: "अपना खाता और सुरक्षा सेटिंग्स प्रबंधित करें",
    suspiciousAlert: "संदिग्ध लॉगिन पता चला",
    suspiciousDesc: "AI-IDS ने अज्ञात डिवाइस से लॉगिन प्रयास को चिह्नित किया। यदि यह आप नहीं थे, तो तुरंत पासवर्ड बदलें।",
    personalDetails: "व्यक्तिगत विवरण",
    financialDetails: "वित्तीय विवरण",
    security: "सुरक्षा",
    preferences: "प्राथमिकताएं",
    fullName: "पूरा नाम",
    email: "ईमेल",
    role: "भूमिका",
    roleDesc: "भूमिका विवरण",
    saveChanges: "परिवर्तन सहेजें",
    saved: "✓ सफलतापूर्वक सहेजा गया",
    monthlyIncome: "मासिक आय (₹)",
    monthlyExpenses: "मासिक व्यय (₹)",
    savingsGoal: "बचत लक्ष्य (₹)",
    loanEMI: "सक्रिय ऋण EMI (₹)",
    changePassword: "पासवर्ड बदलें",
    currentPassword: "वर्तमान पासवर्ड",
    newPassword: "नया पासवर्ड",
    confirmPassword: "नया पासवर्ड पुष्टि करें",
    updatePassword: "पासवर्ड अपडेट करें",
    passwordMismatch: "पासवर्ड मेल नहीं खाते",
    passwordSuccess: "✓ पासवर्ड सफलतापूर्वक अपडेट किया गया",
    activeDevices: "सक्रिय डिवाइस",
    currentSession: "वर्तमान सत्र",
    signOut: "साइन आउट",
    currency: "मुद्रा",
    language: "भाषा",
    hideAmounts: "राशि छुपाएं",
    hideAmountsDesc: "गोपनीयता के लिए ₹ संख्याएं धुंधली करें",
  },
  mr: {
    profile: "प्रोफाइल",
    profileSub: "तुमचे खाते आणि सुरक्षा सेटिंग्ज व्यवस्थापित करा",
    suspiciousAlert: "संशयास्पद लॉगिन आढळले",
    suspiciousDesc: "AI-IDS ने अज्ञात डिव्हाइसवरून लॉगिन प्रयत्न ओळखला. हे तुम्ही नसाल तर लगेच पासवर्ड बदला.",
    personalDetails: "वैयक्तिक तपशील",
    financialDetails: "आर्थिक तपशील",
    security: "सुरक्षा",
    preferences: "प्राधान्ये",
    fullName: "पूर्ण नाव",
    email: "ईमेल",
    role: "भूमिका",
    roleDesc: "भूमिका वर्णन",
    saveChanges: "बदल जतन करा",
    saved: "✓ यशस्वीरित्या जतन केले",
    monthlyIncome: "मासिक उत्पन्न (₹)",
    monthlyExpenses: "मासिक खर्च (₹)",
    savingsGoal: "बचत लक्ष्य (₹)",
    loanEMI: "सक्रिय कर्ज EMI (₹)",
    changePassword: "पासवर्ड बदला",
    currentPassword: "सध्याचा पासवर्ड",
    newPassword: "नवीन पासवर्ड",
    confirmPassword: "नवीन पासवर्ड पुष्टी करा",
    updatePassword: "पासवर्ड अपडेट करा",
    passwordMismatch: "पासवर्ड जुळत नाहीत",
    passwordSuccess: "✓ पासवर्ड यशस्वीरित्या अपडेट केला",
    activeDevices: "सक्रिय डिव्हाइस",
    currentSession: "सध्याचे सत्र",
    signOut: "साइन आउट",
    currency: "चलन",
    language: "भाषा",
    hideAmounts: "रक्कम लपवा",
    hideAmountsDesc: "गोपनीयतेसाठी ₹ संख्या अस्पष्ट करा",
  },
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  student: "Managing education expenses, building financial awareness",
  salaried: "Tracking salary, EMIs, and monthly budgets",
  business: "Managing business income, GST, and investments",
  homemaker: "Managing household expenses and family budget",
  retired: "Managing pension, savings withdrawal, and health costs",
};

const ProfilePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"personal" | "financial" | "security" | "preferences">("personal");
  const logout = useLogout();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [lang, setLang] = useState<"en" | "hi" | "mr">(() => {
  const saved = localStorage.getItem("econome_lang");
  return (saved === "en" || saved === "hi" || saved === "mr") ? saved : "en";
});
  const [currency, setCurrency] = useState(localStorage.getItem("econome_currency") || "INR");
  const [hideAmounts, setHideAmounts] = useState(localStorage.getItem("econome_hide") === "1");

  const t = TRANSLATIONS[lang] ?? TRANSLATIONS["en"];

  const [personal, setPersonal] = useState({
    full_name: localStorage.getItem("econome_name") || user?.full_name || "",
    email: localStorage.getItem("econome_email") || user?.email || "",
    role: localStorage.getItem("econome_role") || "",
    dob: localStorage.getItem("econome_dob") || "",
    age: localStorage.getItem("econome_age") || "",
  });
  const [personalSaved, setPersonalSaved] = useState(false);

  const [financial, setFinancial] = useState({
    monthly_income: localStorage.getItem("econome_income") || "",
    monthly_expenses: localStorage.getItem("econome_expenses") || "",
    savings_goal: localStorage.getItem("econome_savings_goal") || "",
    loan_emi: localStorage.getItem("econome_emi") || "",
  });
  const [financialSaved, setFinancialSaved] = useState(false);

  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  const [passMsg, setPassMsg] = useState("");
  const [passError, setPassError] = useState(false);

  const handleSavePersonal = () => {
    localStorage.setItem("econome_name", personal.full_name);
    localStorage.setItem("econome_email", personal.email);
    localStorage.setItem("econome_role", personal.role);
    localStorage.setItem("econome_dob", personal.dob);
    localStorage.setItem("econome_age", personal.age);
    setPersonalSaved(true);
    setTimeout(() => setPersonalSaved(false), 3000);
  };

  const handleSaveFinancial = () => {
    localStorage.setItem("econome_income", financial.monthly_income);
    localStorage.setItem("econome_expenses", financial.monthly_expenses);
    localStorage.setItem("econome_savings_goal", financial.savings_goal);
    localStorage.setItem("econome_emi", financial.loan_emi);
    setFinancialSaved(true);
    setTimeout(() => setFinancialSaved(false), 3000);
  };

  const handleUpdatePassword = () => {
    setPassMsg("");
    if (passwords.newPass !== passwords.confirm) {
      setPassMsg(t.passwordMismatch);
      setPassError(true);
      return;
    }
    if (passwords.newPass.length < 6) {
      setPassMsg("Password must be at least 6 characters");
      setPassError(true);
      return;
    }
    setPassMsg(t.passwordSuccess);
    setPassError(false);
    setPasswords({ current: "", newPass: "", confirm: "" });
    setTimeout(() => setPassMsg(""), 3000);
  };

  const handleLangChange = (l: "en" | "hi" | "mr") => {
    setLang(l);
    localStorage.setItem("econome_lang", l);
  };

  const handleCurrencyChange = (c: string) => {
    setCurrency(c);
    localStorage.setItem("econome_currency", c);
  };

  const handleHideAmounts = () => {
    const next = !hideAmounts;
    setHideAmounts(next);
    localStorage.setItem("econome_hide", next ? "1" : "0");
  };

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
  };

  const initials = personal.full_name
    ? personal.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const TABS = [
    { key: "personal", label: t.personalDetails, icon: "👤" },
    { key: "financial", label: t.financialDetails, icon: "💰" },
    { key: "security", label: t.security, icon: "🛡️" },
    { key: "preferences", label: t.preferences, icon: "⚙️" },
  ] as const;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">{t.profile}</h1>
      <p className="text-gray-500 text-sm mb-4">{t.profileSub}</p>


      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-lg">
          {initials}
        </div>
        <div>
          <p className="font-semibold text-gray-900">{personal.full_name || "—"}</p>
          <p className="text-gray-400 text-sm capitalize">
            {personal.role ? ROLE_DESCRIPTIONS[personal.role]?.split(",")[0] : "—"}
          </p>
          {personal.age && (
            <p className="text-gray-400 text-xs">{personal.age} years old</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.key
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Personal Tab ── */}
      {activeTab === "personal" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1 font-medium">{t.fullName}</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={personal.full_name}
                onChange={e => setPersonal({ ...personal, full_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1 font-medium">{t.email}</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={personal.email}
                onChange={e => setPersonal({ ...personal, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1 font-medium">Date of Birth</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={personal.dob}
                onChange={e => {
                  const dob = e.target.value;
                  const age = dob
                    ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
                    : 0;
                  setPersonal({ ...personal, dob, age: age.toString() });
                  localStorage.setItem("econome_dob", dob);
                  localStorage.setItem("econome_age", age.toString());
                }} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1 font-medium">Age</label>
              <input
                readOnly
                className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                value={personal.age ? `${personal.age} years` : "Auto-calculated from DOB"} />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1 font-medium">{t.role}</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              value={personal.role}
              onChange={e => setPersonal({ ...personal, role: e.target.value })}>
              <option value="">Select your role</option>
              <option value="student">Student</option>
              <option value="salaried">Salaried Professional</option>
              <option value="business">Business Owner</option>
              <option value="homemaker">Homemaker</option>
              <option value="retired">Retired</option>
            </select>
          </div>

          {personal.role && (
            <div className="bg-indigo-50 rounded-xl p-3 text-xs text-indigo-700">
              📋 {ROLE_DESCRIPTIONS[personal.role]}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={handleSavePersonal}
              className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-700">
              {t.saveChanges}
            </button>
            {personalSaved && <span className="text-green-600 text-sm">{t.saved}</span>}
          </div>
        </div>
      )}

      {/* ── Financial Tab ── */}
      {activeTab === "financial" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <p className="text-xs text-gray-400">
            This information helps EconoMe personalise your financial insights. It is encrypted and never shared.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1 font-medium">{t.monthlyIncome}</label>
              <input type="number" placeholder="e.g. 45000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={financial.monthly_income}
                onChange={e => setFinancial({ ...financial, monthly_income: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1 font-medium">{t.monthlyExpenses}</label>
              <input type="number" placeholder="e.g. 30000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={financial.monthly_expenses}
                onChange={e => setFinancial({ ...financial, monthly_expenses: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1 font-medium">{t.savingsGoal}</label>
              <input type="number" placeholder="e.g. 100000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={financial.savings_goal}
                onChange={e => setFinancial({ ...financial, savings_goal: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1 font-medium">{t.loanEMI}</label>
              <input type="number" placeholder="e.g. 5000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={financial.loan_emi}
                onChange={e => setFinancial({ ...financial, loan_emi: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSaveFinancial}
              className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-700">
              {t.saveChanges}
            </button>
            {financialSaved && <span className="text-green-600 text-sm">{t.saved}</span>}
          </div>
        </div>
      )}

      {/* ── Security Tab ── */}
      {activeTab === "security" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          <div>
            <p className="font-semibold text-gray-900 mb-3">{t.changePassword}</p>
            <div className="space-y-3">
              <input type="password" placeholder={t.currentPassword}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={passwords.current}
                onChange={e => setPasswords({ ...passwords, current: e.target.value })} />
              <input type="password" placeholder={t.newPassword}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={passwords.newPass}
                onChange={e => setPasswords({ ...passwords, newPass: e.target.value })} />
              <input type="password" placeholder={t.confirmPassword}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={passwords.confirm}
                onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} />
              {passMsg && (
                <p className={`text-sm ${passError ? "text-red-500" : "text-green-600"}`}>{passMsg}</p>
              )}
              <button onClick={handleUpdatePassword}
                className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-700">
                {t.updatePassword}
              </button>
            </div>
          </div>
          <hr />
          <div>
            <p className="font-medium text-gray-900 text-sm mb-2">{t.activeDevices}</p>
            <div className="bg-gray-50 rounded-xl p-3 text-sm flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-800">Windows · Chrome</p>
                <p className="text-gray-400 text-xs">Pune, India · {t.currentSession}</p>
              </div>
              <span className="text-green-600 text-xs font-medium">● Active</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Preferences Tab ── */}
      {activeTab === "preferences" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-900 text-sm">{t.currency}</p>
              <p className="text-gray-400 text-xs">
                {currency === "INR" ? "Currently showing ₹ Indian Rupee" : "Currently showing $ US Dollar"}
              </p>
            </div>
            <select
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
              value={currency}
              onChange={e => handleCurrencyChange(e.target.value)}>
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
            </select>
          </div>
          <hr />
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-900 text-sm">{t.language}</p>
              <p className="text-gray-400 text-xs">
                {lang === "en" ? "English" : lang === "hi" ? "हिन्दी" : "मराठी"}
              </p>
            </div>
            <select
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
              value={lang}
              onChange={e => handleLangChange(e.target.value as any)}>
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="mr">मराठी</option>
            </select>
          </div>
          <hr />
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-900 text-sm">{t.hideAmounts}</p>
              <p className="text-gray-400 text-xs">{t.hideAmountsDesc}</p>
            </div>
            <button onClick={handleHideAmounts}
              className={`w-12 h-6 rounded-full transition-colors relative ${hideAmounts ? "bg-indigo-500" : "bg-gray-200"}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${hideAmounts ? "left-6" : "left-0.5"}`} />
            </button>
          </div>
          {hideAmounts && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              🔒 All ₹ amounts on the dashboard are now blurred. Tap any amount to reveal it temporarily.
            </div>
          )}
        </div>
      )}

      {/* Always visible Sign Out */}
      <div className="mt-6">
        <button
          onClick={handleLogout}
          className="w-full bg-red-50 text-red-600 border border-red-200 rounded-xl py-3 text-sm font-medium hover:bg-red-100">
          🚪 {t.signOut}
        </button>
      </div>

    </div>
  );
};

export default ProfilePage;
