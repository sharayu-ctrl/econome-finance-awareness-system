import React, { useState, useRef, useEffect } from "react";
import { useFinanceSummary, useMacroData } from "../lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const LANG_LABELS: Record<string, Record<string, any>> = {
  en: {
    title: "EconoMe AI Tutor",
    subtitle: "Your personal finance educator",
    placeholder: "Ask about EMIs, inflation, savings, budget...",
    clear: "Clear Chat",
    typing: "EconoMe is thinking...",
    disclaimer: "Educational only · Not investment advice",
    context: "Live context",
    suggested: "Suggested questions:",
    quick: ["Explain EMI", "Tax saving tips", "SIP vs FD?", "Rupee falling?", "Budget tips"],
  },
  hi: {
    title: "EconoMe AI ट्यूटर",
    subtitle: "आपका व्यक्तिगत वित्त शिक्षक",
    placeholder: "EMI, महंगाई, बचत के बारे में पूछें...",
    clear: "चैट साफ़ करें",
    typing: "EconoMe सोच रहा है...",
    disclaimer: "केवल शैक्षिक · निवेश सलाह नहीं",
    context: "लाइव संदर्भ",
    suggested: "सुझाए गए प्रश्न:",
    quick: ["EMI समझाएं", "टैक्स बचत", "SIP vs FD?", "रुपया गिर रहा?", "बजट टिप्स"],
  },
  mr: {
    title: "EconoMe AI शिक्षक",
    subtitle: "तुमचा वैयक्तिक वित्त शिक्षक",
    placeholder: "EMI, महागाई, बचत याबद्दल विचारा...",
    clear: "चॅट साफ करा",
    typing: "EconoMe विचार करत आहे...",
    disclaimer: "केवळ शैक्षणिक · गुंतवणूक सल्ला नाही",
    context: "लाइव्ह संदर्भ",
    suggested: "सुचवलेले प्रश्न:",
    quick: ["EMI सांगा", "टॅक्स बचत", "SIP vs FD?", "रुपया घसरतोय?", "बजट टिप्स"],
  },
};

const STARTERS: Record<string, string[]> = {
  en: [
    "How does the repo rate affect my EMI?",
    "Why is my savings rate dropping?",
    "How does inflation affect my grocery budget?",
    "What should I do if rupee is weakening?",
    "How to build an emergency fund?",
    "Explain the 50/30/20 rule",
    "What is CPI inflation?",
    "How do I reduce my expenses?",
  ],
  hi: [
    "रेपो दर मेरे EMI को कैसे प्रभावित करती है?",
    "मेरी बचत दर क्यों घट रही है?",
    "महंगाई मेरे बजट को कैसे प्रभावित करती है?",
    "इमरजेंसी फंड कैसे बनाएं?",
    "50/30/20 नियम क्या है?",
  ],
  mr: [
    "रेपो दर माझ्या EMI वर कसा परिणाम करतो?",
    "माझी बचत दर का घसरत आहे?",
    "महागाई माझ्या बजटवर कसा परिणाम करते?",
    "आपत्कालीन निधी कसा तयार करावा?",
    "50/30/20 नियम काय आहे?",
  ],
};

// ── Knowledge Base ────────────────────────────────────────────────────────────
interface Context {
  name: string;
  role: string;
  age: string;
  income: number;
  expenses: number;
  savingsRate: number;
  savingsGoal: number;
  emi: number;
  loanType: string;
  repoRate: number;
  cpi: number;
  usdInr: number;
  crude: number;
  lang: string;
}

const buildContext = (financeSummary: any, macroData: any, lang: string): Context => ({
  name: localStorage.getItem("econome_name")?.split(" ")[0] || "there",
  role: localStorage.getItem("econome_role") || "salaried",
  age: localStorage.getItem("econome_age") || "unknown",
  income: financeSummary?.total_income || parseFloat(localStorage.getItem("econome_income") || "0"),
  expenses: financeSummary?.total_expense || parseFloat(localStorage.getItem("econome_expenses") || "0"),
  savingsRate: financeSummary?.savings_rate || 0,
  savingsGoal: parseFloat(localStorage.getItem("econome_savings_goal") || "0"),
  emi: parseFloat(localStorage.getItem("econome_emi") || "0"),
  loanType: localStorage.getItem("econome_loan_type") || "none",
  repoRate: macroData?.REPO_RATE?.value ?? 6.5,
  cpi: macroData?.CPI_INDIA?.value ?? 5.4,
  usdInr: macroData?.USD_INR?.value ?? 83.6,
  crude: macroData?.CRUDE_OIL?.value ?? 82.4,
  lang,
});

const fmt = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`;

// ── Response Generator ────────────────────────────────────────────────────────
const generateResponse = (userMsg: string, ctx: Context, history: Message[]): string => {
  const q = userMsg.toLowerCase();
  const { name, role, income, expenses, savingsRate, emi, loanType,
    repoRate, cpi, usdInr, crude, savingsGoal, age, lang } = ctx;

  const savingsPct = (savingsRate * 100).toFixed(1);
  const netSavings = income - expenses;
  const emiRatio = income > 0 ? ((emi / income) * 100).toFixed(1) : "unknown";

  // ── Investment advice guardrail ──────────────────────────────────────────
  if (/\b(buy|purchase|which stock|which fund|recommend.*fund|best.*stock|guaranteed return)\b/i.test(q)) {
    if (lang === "hi") return "मैं विशिष्ट निवेश सलाह नहीं दे सकता। इसके लिए किसी SEBI-पंजीकृत वित्तीय सलाहकार से मिलें। लेकिन मैं आपको SIP, म्यूचुअल फंड, या FD के बारे में शैक्षिक जानकारी दे सकता हूं। क्या आप यह जानना चाहते हैं?";
    if (lang === "mr") return "मी विशिष्ट गुंतवणूक सल्ला देऊ शकत नाही. SEBI-नोंदणीकृत सल्लागाराशी संपर्क करा. मी SIP, म्युच्युअल फंड किंवा FD बद्दल शैक्षणिक माहिती देऊ शकतो. तुम्हाला हे जाणायचे आहे का?";
    return `${name}, I can't give personalised investment recommendations — for that, please consult a SEBI-registered financial advisor. However, I can explain how SIPs, mutual funds, FDs, or PPF work educationally. Would you like me to explain any of these concepts?`;
  }

  // ── Repo Rate ────────────────────────────────────────────────────────────
  if (/repo rate|interest rate|rbi rate/i.test(q)) {
    const emiImpact = emi > 0 ? `\n\n📌 Your situation: With your ${loanType} EMI of ${fmt(emi)}, a 0.25% repo rate change would add roughly ₹${Math.round(emi * 0.003).toLocaleString("en-IN")}–₹${Math.round(emi * 0.005).toLocaleString("en-IN")} to your monthly payment.` : "";
    if (lang === "hi") return `🏦 रेपो दर वह ब्याज दर है जिस पर RBI बैंकों को पैसे उधार देता है।\n\nवर्तमान दर: ${repoRate}%\n\nयह आपको कैसे प्रभावित करता है:\n• जब रेपो दर बढ़ती है → बैंक अधिक ब्याज लेते हैं → आपकी EMI बढ़ती है\n• जब रेपो दर घटती है → EMI कम होती है → FD पर कम रिटर्न\n\n${emi > 0 ? `📌 आपकी स्थिति: आपकी ${fmt(emi)} EMI पर 0.25% बदलाव से ₹${Math.round(emi * 0.003).toLocaleString("en-IN")}–₹${Math.round(emi * 0.005).toLocaleString("en-IN")} का अंतर आएगा।` : ""}\n\nक्या आप जानना चाहते हैं कि यह आपकी बचत को कैसे प्रभावित करता है?`;
    if (lang === "mr") return `🏦 रेपो दर म्हणजे RBI बँकांना पैसे कर्ज देण्याचा व्याजदर.\n\nसध्याचा दर: ${repoRate}%\n\nतुमच्यावर परिणाम:\n• रेपो दर वाढला → बँका जास्त व्याज आकारतात → तुमची EMI वाढते\n• रेपो दर कमी झाला → EMI कमी होते → FD वर कमी परतावा\n\n${emi > 0 ? `📌 तुमची स्थिती: ${fmt(emi)} EMI वर 0.25% बदलाने ₹${Math.round(emi * 0.003).toLocaleString("en-IN")}–₹${Math.round(emi * 0.005).toLocaleString("en-IN")} फरक पडेल.` : ""}\n\nहे तुमच्या बचतीवर कसा परिणाम करते ते जाणायचे आहे का?`;
    return `🏦 The Repo Rate is the interest rate at which the RBI lends money to commercial banks.\n\nCurrent Rate: ${repoRate}%\n\nHow it affects you:\n• Rate goes UP → Banks charge more → Your EMIs increase\n• Rate goes DOWN → EMIs reduce → FD returns also fall\n• ${repoRate > 6.5 ? "Current rate is elevated — borrowing is expensive right now." : "Rate is moderate — a balanced environment for borrowers."}${emiImpact}\n\nWould you like to know how to plan around potential rate changes?`;
  }

  // ── Inflation / CPI ──────────────────────────────────────────────────────
  if (/inflation|cpi|price rise|mahangai|महंगाई|महागाई/i.test(q)) {
    const groceryImpact = expenses > 0 ? Math.round(expenses * (cpi / 100)) : 0;
    if (lang === "hi") return `📊 CPI (Consumer Price Index) मापता है कि रोज़मर्रा की चीज़ें कितनी महंगी हुई हैं।\n\nवर्तमान CPI: ${cpi}%\n\nइसका मतलब: अगर पिछले साल ₹100 में किराना आता था, अब ${(100 + cpi).toFixed(1)} रुपये लगेंगे।\n\n${groceryImpact > 0 ? `📌 आपकी स्थिति: आपके ₹${expenses.toLocaleString("en-IN")} मासिक खर्च पर महंगाई का असर लगभग ${fmt(groceryImpact)}/माह है।` : ""}\n\n${cpi > 6 ? "⚠️ CPI 6% से ऊपर है — RBI इसे कम करने के लिए रेपो दर बढ़ा सकता है।" : "✅ CPI RBI के लक्ष्य के भीतर है।"}\n\nक्या आप जानना चाहते हैं कि महंगाई से अपनी बचत कैसे बचाएं?`;
    if (lang === "mr") return `📊 CPI (ग्राहक किंमत निर्देशांक) रोजच्या वस्तूंच्या किंमती किती वाढल्या हे मोजतो.\n\nसध्याचा CPI: ${cpi}%\n\nयाचा अर्थ: गेल्या वर्षी ₹100 मध्ये मिळणाऱ्या किराणा मालासाठी आता ₹${(100 + cpi).toFixed(1)} लागतात.\n\n${groceryImpact > 0 ? `📌 तुमची स्थिती: तुमच्या ₹${expenses.toLocaleString("en-IN")} मासिक खर्चावर महागाईचा परिणाम सुमारे ${fmt(groceryImpact)}/महिना आहे.` : ""}\n\n${cpi > 6 ? "⚠️ CPI 6% पेक्षा जास्त आहे — RBI रेपो दर वाढवू शकतो." : "✅ CPI RBI च्या लक्ष्यात आहे."}\n\nमहागाईपासून बचत कशी वाचवावी हे जाणायचे आहे का?`;
    return `📊 CPI (Consumer Price Index) measures how much everyday items have gotten more expensive.\n\nCurrent CPI: ${cpi}% annually\n\nWhat this means: Something that cost ₹100 last year now costs ₹${(100 + cpi).toFixed(1)}.\n\n${groceryImpact > 0 ? `📌 Your situation: Your monthly expenses of ${fmt(expenses)} are effectively ${fmt(groceryImpact)} more expensive due to inflation this year.` : ""}\n\n${cpi > 6 ? "⚠️ CPI is above 6% — RBI may raise repo rate to cool it down, which increases EMIs." : "✅ CPI is within RBI's comfort zone (2-6%)."}\n\nWould you like tips on how to inflation-proof your budget?`;
  }

  // ── Savings rate ─────────────────────────────────────────────────────────
  if (/saving|bachat|बचत|savings rate|save more/i.test(q)) {
    const targetSavings = income * 0.2;
    const gap = targetSavings - netSavings;
    if (lang === "hi") return `💰 आपकी बचत स्थिति:\n\nवर्तमान बचत दर: ${savingsPct}%\n${savingsRate >= 0.2 ? "✅ बढ़िया! आप 20% लक्ष्य से ऊपर हैं।" : savingsRate >= 0.1 ? "🟡 ठीक है, लेकिन 20% लक्ष्य तक पहुंचने की कोशिश करें।" : "🔴 ध्यान दें! बचत दर 10% से कम है।"}\n\n${income > 0 ? `आपकी आय ${fmt(income)} है। 20% बचत लक्ष्य = ${fmt(targetSavings)}/माह\n${gap > 0 ? `अंतर: ${fmt(gap)}/माह कम बचा रहे हैं` : "आप लक्ष्य पर हैं! 🎉"}` : ""}\n\nबचत बढ़ाने के तरीके:\n• पहले बचत करें, फिर खर्च करें\n• SIP के ज़रिए स्वचालित बचत\n• अनावश्यक सब्सक्रिप्शन बंद करें\n• खाने का बजट तय करें\n\nक्या आप किसी विशेष खर्च श्रेणी पर चर्चा करना चाहते हैं?`;
    if (lang === "mr") return `💰 तुमची बचत स्थिती:\n\nसध्याची बचत दर: ${savingsPct}%\n${savingsRate >= 0.2 ? "✅ छान! तुम्ही 20% लक्ष्यापेक्षा वर आहात." : savingsRate >= 0.1 ? "🟡 ठीक आहे, पण 20% लक्ष्यापर्यंत पोहोचण्याचा प्रयत्न करा." : "🔴 लक्ष द्या! बचत दर 10% पेक्षा कमी आहे."}\n\n${income > 0 ? `तुमचे उत्पन्न ${fmt(income)} आहे. 20% बचत लक्ष्य = ${fmt(targetSavings)}/महिना\n${gap > 0 ? `अंतर: ${fmt(gap)}/महिना कमी बचत होत आहे` : "तुम्ही लक्ष्यावर आहात! 🎉"}` : ""}\n\nबचत वाढवण्याचे मार्ग:\n• आधी बचत करा, मग खर्च करा\n• SIP द्वारे स्वयंचलित बचत\n• अनावश्यक सदस्यता बंद करा\n• जेवणाचे बजट ठरवा\n\nकोणत्या खर्च श्रेणीवर चर्चा करायची आहे का?`;
    return `💰 Your Savings Snapshot:\n\nCurrent savings rate: ${savingsPct}%\n${savingsRate >= 0.2 ? "✅ Great! You're above the recommended 20% target." : savingsRate >= 0.1 ? "🟡 Okay, but try to push towards 20%." : "🔴 Alert! Your savings rate is below 10% — very thin buffer."}\n\n${income > 0 ? `Your income is ${fmt(income)}. A 20% savings target = ${fmt(targetSavings)}/month.\n${gap > 0 ? `You're currently saving ${fmt(gap)} less than ideal.` : "You're on track! 🎉"}` : ""}\n\nWays to increase savings:\n• Pay yourself first — transfer savings on salary day\n• Automate savings via recurring deposits\n• Cut unused subscriptions\n• Set a weekly grocery budget\n• The 50/30/20 rule: 50% needs, 30% wants, 20% savings\n\nWould you like to analyse a specific expense category?`;
  }

  // ── EMI ──────────────────────────────────────────────────────────────────
  if (/\bemi\b|loan|equated|karz|कर्ज/i.test(q)) {
    if (lang === "hi") return `🏦 EMI (Equated Monthly Installment) वह मासिक किस्त है जो आप अपने ऋण के लिए चुकाते हैं।\n\n${emi > 0 ? `आपकी वर्तमान EMI: ${fmt(emi)}/माह (${loanType})\nEMI-आय अनुपात: ${emiRatio}%\n${parseFloat(emiRatio) > 40 ? "⚠️ आपका EMI बोझ 40% से अधिक है — यह जोखिम भरा है।" : parseFloat(emiRatio) > 25 ? "🟡 EMI बोझ प्रबंधनीय है लेकिन ध्यान रखें।" : "✅ EMI बोझ स्वस्थ सीमा में है।"}` : "आपने कोई सक्रिय लोन दर्ज नहीं किया है।"}\n\nEMI कैसे काम करती है:\n• बैंक मूलधन + ब्याज = मासिक किस्त\n• रेपो दर बढ़ने पर फ्लोटिंग रेट EMI बढ़ती है\n• प्रीपेमेंट से ब्याज बचाया जा सकता है\n\nक्या आप EMI कम करने के तरीके जानना चाहते हैं?`;
    if (lang === "mr") return `🏦 EMI (Equated Monthly Installment) म्हणजे तुम्ही कर्जासाठी दरमहा भरता ती हप्ता रक्कम.\n\n${emi > 0 ? `तुमची सध्याची EMI: ${fmt(emi)}/महिना (${loanType})\nEMI-उत्पन्न गुणोत्तर: ${emiRatio}%\n${parseFloat(emiRatio) > 40 ? "⚠️ EMI भार 40% पेक्षा जास्त आहे — हे धोकादायक आहे." : parseFloat(emiRatio) > 25 ? "🟡 EMI भार व्यवस्थापित आहे पण लक्ष ठेवा." : "✅ EMI भार आरोग्यदायी मर्यादेत आहे."}` : "तुम्ही कोणतेही सक्रिय कर्ज नोंदवलेले नाही."}\n\nEMI कशी काम करते:\n• बँक मूलधन + व्याज = मासिक हप्ता\n• रेपो दर वाढल्यास फ्लोटिंग रेट EMI वाढते\n• प्रीपेमेंटने व्याज वाचवता येते\n\nEMI कमी करण्याचे मार्ग जाणायचे आहेत का?`;
    return `🏦 EMI (Equated Monthly Installment) is the fixed monthly payment you make towards a loan.\n\n${emi > 0 ? `Your current EMI: ${fmt(emi)}/month (${loanType})\nEMI-to-income ratio: ${emiRatio}%\n${parseFloat(emiRatio) > 40 ? "⚠️ Your EMI burden exceeds 40% of income — this is a risk zone." : parseFloat(emiRatio) > 25 ? "🟡 EMI burden is manageable but keep monitoring." : "✅ Your EMI burden is in a healthy range."}` : "You haven't added any active loan details yet."}\n\nHow EMI works:\n• Bank calculates: Principal + Interest = Monthly payment\n• Floating rate EMIs rise when RBI increases repo rate\n• Making prepayments reduces total interest paid significantly\n• Current repo rate of ${repoRate}% means ${repoRate > 6.5 ? "borrowing is expensive" : "moderate borrowing costs"}\n\nWould you like to know how to reduce your EMI burden?`;
  }

  // ── Rupee / USD-INR ──────────────────────────────────────────────────────
  if (/rupee|dollar|usd|inr|currency|forex/i.test(q)) {
    if (lang === "hi") return `💱 USD/INR दर: ₹${usdInr.toFixed(2)} प्रति डॉलर\n\n${usdInr > 84 ? "⚠️ रुपया कमज़ोर है" : "✅ रुपया स्थिर है"}\n\nरुपये के कमज़ोर होने का असर:\n• पेट्रोल और डीज़ल महंगा होता है (भारत 85% तेल आयात करता है)\n• इलेक्ट्रॉनिक्स, मोबाइल महंगे होते हैं\n• विदेश में पढ़ाई महंगी होती है\n• IT कंपनियों को ज़्यादा रुपये मिलते हैं\n\n${role === "salaried" ? `आप ${role} हैं — रुपये की कमज़ोरी आपकी पेट्रोल और किराने की लागत बढ़ाएगी।` : ""}\n\nक्या आप जानना चाहते हैं कि रुपये की कमज़ोरी आपके बजट को कैसे प्रभावित करती है?`;
    if (lang === "mr") return `💱 USD/INR दर: ₹${usdInr.toFixed(2)} प्रति डॉलर\n\n${usdInr > 84 ? "⚠️ रुपया कमकुवत आहे" : "✅ रुपया स्थिर आहे"}\n\nरुपया कमकुवत झाल्याचा परिणाम:\n• पेट्रोल आणि डिझेल महाग होते (भारत 85% तेल आयात करतो)\n• इलेक्ट्रॉनिक्स, मोबाइल महाग होतात\n• परदेशात शिक्षण महाग होते\n• IT कंपन्यांना जास्त रुपये मिळतात\n\nतुमच्या बजटवर रुपयाच्या घसरणीचा कसा परिणाम होतो ते जाणायचे आहे का?`;
    return `💱 Current USD/INR: ₹${usdInr.toFixed(2)} per dollar\n\n${usdInr > 84 ? "⚠️ The rupee is weak right now." : "✅ The rupee is relatively stable."}\n\nWhat a weaker rupee means for you:\n• Petrol & diesel get expensive (India imports 85% of crude oil in dollars)\n• Electronics, phones, imported goods cost more\n• Foreign education loans become costlier\n• IT professionals earning in dollars get more rupees\n• Medicines with imported ingredients get pricier\n\nCurrent crude oil at $${crude.toFixed(0)}/barrel ${crude > 85 ? "is already high — petrol prices may rise in 2–4 weeks." : "is manageable — petrol prices should stay stable."}\n\n${income > 0 ? `For your income of ${fmt(income)}, a 1% rise in petrol/diesel adds roughly ₹${Math.round(income * 0.003).toLocaleString("en-IN")} to monthly transport costs.` : ""}\n\nWould you like to know how to protect your budget from currency fluctuations?`;
  }

  // ── Emergency fund ───────────────────────────────────────────────────────
  if (/emergency fund|contingency|rainy day|emergency/i.test(q)) {
    const target = expenses > 0 ? expenses * 6 : 0;
    if (lang === "hi") return `🛡️ इमरजेंसी फंड क्यों ज़रूरी है:\n\nयह 3-6 महीने के खर्चों की बचत है जो किसी भी अचानक ज़रूरत के लिए काम आती है।\n\n${expenses > 0 ? `📌 आपके लिए लक्ष्य: ${fmt(target)} (${fmt(expenses)} × 6 महीने)` : ""}\n\nइसे कहां रखें:\n• लिक्विड म्यूचुअल फंड (2-3 दिन में निकाल सकते हैं)\n• हाई-यील्ड सेविंग्स अकाउंट\n• FD (Recurring Deposit से शुरू करें)\n\nकैसे बनाएं:\n• हर महीने ${fmt(Math.round((target / 12)))} बचाएं\n• 1 साल में पूरा लक्ष्य पाएं\n• सैलरी आते ही ऑटो-ट्रांसफर करें\n\nक्या आप इसे अपनी आय के अनुसार प्लान करना चाहते हैं?`;
    return `🛡️ An Emergency Fund is 3–6 months of essential expenses kept liquid and accessible.\n\n${expenses > 0 ? `📌 Your target: ${fmt(target)} (${fmt(expenses)} × 6 months)` : "Add your monthly expenses in profile to get a personalised target."}\n\nWhere to keep it:\n• Liquid mutual fund (accessible in 2–3 business days)\n• High-yield savings account\n• Short-term FD or Recurring Deposit\n\nNOT in:\n• Equity investments (value can fall when you need it most)\n• Long-term FDs (premature withdrawal penalty)\n\nHow to build it:\n${expenses > 0 ? `• Save ${fmt(Math.round(target / 12))}/month for 12 months\n• Or ${fmt(Math.round(target / 6))}/month for 6 months` : "• Start with ₹2,000–5,000/month regardless of income"}\n• Auto-transfer on salary day before spending\n\nWould you like a month-by-month plan to build your emergency fund?`;
  }

  // ── 50/30/20 rule ────────────────────────────────────────────────────────
  if (/50.30.20|budget rule|budgeting rule/i.test(q)) {
    const needs = income * 0.5;
    const wants = income * 0.3;
    const savings50 = income * 0.2;
    if (lang === "hi") return `💡 50/30/20 नियम:\n\n${income > 0 ? `आपकी आय ${fmt(income)} के हिसाब से:\n\n• 50% ज़रूरतें (Needs): ${fmt(needs)}\n  किराया, राशन, बिजली, EMI, दवाइयां\n\n• 30% इच्छाएं (Wants): ${fmt(wants)}\n  खाना बाहर, मनोरंजन, शॉपिंग\n\n• 20% बचत (Savings): ${fmt(savings50)}\n  इमरजेंसी फंड, लक्ष्य बचत\n\nआपकी वर्तमान बचत: ${fmt(income - expenses)} (${savingsPct}%)` : "50% ज़रूरतें, 30% इच्छाएं, 20% बचत — यह एक सरल बजट फ्रेमवर्क है।"}\n\nक्या आप इस नियम के अनुसार अपना बजट बनाना चाहते हैं?`;
    return `💡 The 50/30/20 Rule is a simple budgeting framework:\n\n${income > 0 ? `Based on your income of ${fmt(income)}:\n\n• 50% Needs (${fmt(needs)})\n  Rent, groceries, electricity, EMI, medicines, transport\n\n• 30% Wants (${fmt(wants)})\n  Dining out, entertainment, shopping, subscriptions\n\n• 20% Savings (${fmt(savings50)})\n  Emergency fund, goals, future security\n\nYour current savings: ${fmt(income - expenses)} (${savingsPct}%)\n${parseFloat(savingsPct) >= 20 ? "✅ You're meeting the 20% savings target!" : `⚠️ You need to save ${fmt(savings50 - (income - expenses))} more to hit 20%.`}` : "50% for needs, 30% for wants, 20% for savings — a simple framework to start budgeting."}\n\nWould you like help categorising your expenses into this framework?`;
  }

  // ── Tax saving ───────────────────────────────────────────────────────────
  if (/tax|80c|section 80|itr|income tax/i.test(q)) {
    if (lang === "hi") return `📋 टैक्स बचत की जानकारी (Section 80C):\n\n⚠️ नोट: मैं विशिष्ट टैक्स सलाह नहीं दे सकता। ITR फाइलिंग के लिए CA से मिलें।\n\nशैक्षिक जानकारी:\n\n• Section 80C: ₹1.5 लाख तक की कटौती\n  PPF, ELSS, LIC, NSC, EPF शामिल\n\n• Section 80D: स्वास्थ्य बीमा प्रीमियम\n  खुद के लिए ₹25,000, माता-पिता के लिए ₹50,000\n\n• HRA: किराया भत्ता (नौकरीपेशा लोगों के लिए)\n\n• NPS: Section 80CCD(1B) से ₹50,000 अतिरिक्त\n\nयाद रखें: टैक्स बचत निवेश का मुख्य कारण नहीं होना चाहिए।\n\nक्या आप किसी विशेष सेक्शन के बारे में जानना चाहते हैं?`;
    return `📋 Tax Saving Education (for salaried individuals):\n\n⚠️ Note: I provide educational information only. For filing ITR or specific tax advice, please consult a CA.\n\nKey tax-saving sections:\n\n• Section 80C (up to ₹1.5 lakh deduction)\n  PPF, ELSS mutual funds, LIC premium, NSC, home loan principal, EPF\n\n• Section 80D (health insurance)\n  ₹25,000 for self, ₹50,000 for senior citizen parents\n\n• HRA Exemption\n  Applicable if you pay rent and get HRA from employer\n\n• Section 80CCD(1B)\n  Additional ₹50,000 for NPS contribution\n\n• Standard Deduction\n  ₹50,000 flat for salaried employees\n\nRemember: Tax saving should be a side benefit — not the primary reason for investing.\n\nWould you like to understand how any specific section works?`;
  }

  // ── SIP vs FD ────────────────────────────────────────────────────────────
  if (/sip|systematic investment|mutual fund|fd|fixed deposit/i.test(q)) {
    return `📊 SIP vs Fixed Deposit — Educational Overview:\n\n⚠️ I can explain how these work, but for choosing which is right for you, consult a SEBI-registered advisor.\n\n🔵 Fixed Deposit (FD):\n• Guaranteed returns (currently ~6.5-7.5% for most banks)\n• No market risk\n• Best for: Emergency fund, short-term goals (1-3 years)\n• Premature withdrawal penalty applies\n\n🟢 SIP (Systematic Investment Plan):\n• Invests in mutual funds via monthly instalments\n• Returns not guaranteed — linked to market performance\n• Historical average: equity funds 10-12% over 10+ years\n• Best for: Long-term goals (5+ years)\n• Tax efficient with ELSS funds (Section 80C)\n\nKey difference: FD = certainty, SIP = potentially higher growth over long term.\n\n${income > 0 ? `For your income of ${fmt(income)}, even a small SIP of ${fmt(Math.round(income * 0.05))} (5% of income) started early can grow significantly over time.` : ""}\n\nWould you like me to explain how compounding works for either of these?`;
  }

  // ── Crude Oil ────────────────────────────────────────────────────────────
  if (/crude|oil|petrol|diesel|fuel/i.test(q)) {
    return `🛢️ Crude Oil & Your Budget:\n\nCurrent crude: $${crude.toFixed(1)}/barrel\n${crude > 85 ? "⚠️ High — expect fuel price pressure in India" : "✅ Moderate — petrol prices should be stable"}\n\nHow crude oil affects you:\n• India imports ~85% of its crude oil in US dollars\n• Higher crude + weaker rupee = double pressure on petrol prices\n• Petrol prices affect: transport costs, food delivery, vegetable prices, airline tickets\n• LPG cylinder prices also track crude oil\n\nChain reaction:\n Crude rises → Petrol rises → Truck transport costs rise → Food prices rise → Inflation goes up → RBI raises repo rate → Your EMI goes up\n\n${emi > 0 ? `This chain could affect both your daily expenses AND your ${fmt(emi)} monthly EMI.` : ""}\n\nWould you like to know how to budget for fuel price volatility?`;
  }

  // ── Budget tips ──────────────────────────────────────────────────────────
  if (/budget|expense|spend|kharch|खर्च/i.test(q)) {
    if (lang === "hi") return `💼 बजट बनाने के व्यावहारिक सुझाव:\n\n${income > 0 ? `आपकी आय: ${fmt(income)}/माह\nआपके खर्च: ${fmt(expenses)}/माह\nबचत: ${fmt(netSavings)}/माह (${savingsPct}%)` : ""}\n\nबजट के 5 सुनहरे नियम:\n\n1. 📝 हर खर्च लिखें — जागरूकता से बचत बढ़ती है\n2. 🥗 घर का खाना > बाहर का खाना\n3. 📱 सब्सक्रिप्शन की समीक्षा करें हर 3 महीने\n4. 🛒 किराने की सूची बनाकर खरीदारी करें\n5. 💳 EMI लेने से पहले सोचें\n\nक्या आप किसी खास खर्च श्रेणी पर बात करना चाहते हैं?`;
    return `💼 Practical Budgeting Tips:\n\n${income > 0 ? `Your income: ${fmt(income)}/month\nYour expenses: ${fmt(expenses)}/month\nNet savings: ${fmt(netSavings)}/month (${savingsPct}%)` : "Add your income and expenses in the profile to get personalised tips."}\n\n5 Golden Budgeting Rules:\n\n1. 📝 Track every expense — awareness is the first step to saving\n2. 🥗 Cook at home more — eating out inflated by 8-12% food inflation\n3. 📱 Audit subscriptions every 3 months (OTT, apps, gym)\n4. 🛒 Make a grocery list before shopping — reduces impulse buying by 20-30%\n5. 💳 Think before taking new EMIs — each EMI locks future income\n\nWith current CPI at ${cpi}%, your expenses are effectively ${cpi}% more than last year. To maintain the same savings, you need to either earn more or cut ${fmt(Math.round(expenses * (cpi / 100)))} from annual spending.\n\nWould you like tips for a specific category like food, transport, or entertainment?`;
  }

  // ── Greeting ─────────────────────────────────────────────────────────────
  if (/^(hi|hello|hey|namaste|नमस्ते|नमस्कार|hii|helo)/i.test(q)) {
    if (lang === "hi") return `नमस्ते ${name}! 😊 मैं यहां हूं। आप मुझसे पूछ सकते हैं:\n\n• EMI और लोन के बारे में\n• महंगाई और बचत के बारे में\n• बजट बनाने के तरीके\n• रुपये और अर्थव्यवस्था के बारे में\n• टैक्स बचत की जानकारी\n\nआज क्या जानना चाहते हैं?`;
    if (lang === "mr") return `नमस्कार ${name}! 😊 मी इथे आहे. तुम्ही मला विचारू शकता:\n\n• EMI आणि कर्जाबद्दल\n• महागाई आणि बचतीबद्दल\n• बजट बनवण्याचे मार्ग\n• रुपया आणि अर्थव्यवस्थेबद्दल\n\nआज काय जाणायचे आहे?`;
    return `Hello ${name}! 😊 I'm here to help you understand your finances better. You can ask me about:\n\n• EMIs and loans\n• Inflation and savings\n• Budgeting strategies\n• Rupee and economy\n• Tax saving concepts\n• Emergency funds\n\nWhat would you like to explore today?`;
  }

  // ── Catch-all with context ────────────────────────────────────────────────
  const contextSummary = income > 0
    ? `Based on your profile — income ${fmt(income)}, savings rate ${savingsPct}%, repo rate ${repoRate}%, CPI ${cpi}% — `
    : `With current repo rate at ${repoRate}% and inflation at ${cpi}%, `;

  if (lang === "hi") return `${contextSummary.replace("Based on your profile —", "आपकी प्रोफ़ाइल के अनुसार —").replace("With current", "वर्तमान")}\n\nयह एक अच्छा सवाल है। मैं इन विषयों पर मदद कर सकता हूं:\n\n• रेपो दर और EMI\n• महंगाई और बजट\n• बचत दर सुधारना\n• इमरजेंसी फंड\n• रुपये की मज़बूती/कमज़ोरी\n• 50/30/20 बजट नियम\n• टैक्स बचत (शैक्षिक)\n\nइनमें से कौन सा विषय जानना चाहते हैं?`;
  if (lang === "mr") return `${contextSummary.replace("Based on your profile —", "तुमच्या प्रोफाइलनुसार —").replace("With current", "सध्याच्या")}\n\nहा एक चांगला प्रश्न आहे. मी या विषयांवर मदत करू शकतो:\n\n• रेपो दर आणि EMI\n• महागाई आणि बजट\n• बचत दर सुधारणे\n• आपत्कालीन निधी\n• रुपयाची स्थिती\n• 50/30/20 बजट नियम\n\nयातील कोणता विषय जाणायचा आहे?`;

  return `${contextSummary}here's what I can help you understand:\n\n• **Repo rate & EMIs** — How RBI decisions affect your loans\n• **Inflation & budget** — What CPI means for your grocery bill\n• **Savings rate** — How to improve your ${savingsPct}% savings rate\n• **Emergency fund** — Building a safety net\n• **Rupee & economy** — How USD/INR affects daily costs\n• **50/30/20 rule** — Simple budgeting framework\n• **Tax saving** — Educational overview of 80C, 80D\n• **SIP vs FD** — Understanding different saving instruments\n\nWhich of these would you like to explore? Or feel free to ask anything specific!`;
};

// ── Chat Bubble ───────────────────────────────────────────────────────────────
const ChatBubble = ({ msg }: { msg: Message }) => {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1">
          AI
        </div>
      )}
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
        isUser
          ? "bg-indigo-600 text-white rounded-br-sm"
          : "bg-white border border-gray-100 text-gray-800 rounded-bl-sm"
      }`}>
        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        <p className={`text-xs mt-1.5 ${isUser ? "text-indigo-200" : "text-gray-400"}`}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold ml-2 flex-shrink-0 mt-1">
          {(localStorage.getItem("econome_name") || "U")[0].toUpperCase()}
        </div>
      )}
    </div>
  );
};

const TypingIndicator = ({ text }: { text: string }) => (
  <div className="flex justify-start mb-4">
    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0">
      AI
    </div>
    <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-3">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <span className="text-xs text-gray-400">{text}</span>
    </div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
const TutorChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [lang, setLang] = useState<"en" | "hi" | "mr">(() => {
    const stored = localStorage.getItem("econome_lang");
    return (stored === "en" || stored === "hi" || stored === "mr") ? stored : "en";
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: financeSummary } = useFinanceSummary();
  const { data: macroData } = useMacroData();

  const t = LANG_LABELS[lang] ?? LANG_LABELS["en"];
  const starters = STARTERS[lang] ?? STARTERS["en"];

  // Initial greeting
  useEffect(() => {
    const name = localStorage.getItem("econome_name")?.split(" ")[0] || "there";
    const role = localStorage.getItem("econome_role") || "";
    const greetings: Record<string, string> = {
      en: `Hi ${name}! 👋 I'm your EconoMe AI Finance Tutor.\n\nI have access to your live financial profile and current economic indicators, so my answers are personalised to your situation${role ? ` as a ${role}` : ""}.\n\nAsk me about:\n• How RBI repo rate affects your EMIs\n• What inflation means for your grocery budget\n• How to improve your savings rate\n• Budgeting strategies and more\n\nWhat would you like to understand today?`,
      hi: `नमस्ते ${name}! 👋 मैं आपका EconoMe AI ट्यूटर हूं।\n\nमुझे आपकी वित्तीय प्रोफ़ाइल और लाइव डेटा तक पहुंच है। पूछें:\n• रेपो दर आपके EMI को कैसे प्रभावित करती है\n• महंगाई आपके बजट पर क्या असर डालती है\n• बचत दर कैसे सुधारें\n\nआज क्या जानना चाहते हैं?`,
      mr: `नमस्कार ${name}! 👋 मी तुमचा EconoMe AI शिक्षक आहे.\n\nतुमच्या आर्थिक प्रोफाइल आणि लाइव्ह डेटाची माहिती मला आहे. विचारा:\n• रेपो दर तुमच्या EMI वर कसा परिणाम करतो\n• महागाई बजटवर काय परिणाम करते\n• बचत दर कशी सुधारावी\n\nआज काय जाणायचे आहे?`,
    };
    const welcomeMsg: Message = {
      role: "assistant",
      content: greetings[lang],
      timestamp: new Date().toISOString(),
    };
    setMessages([welcomeMsg]);
  }, [lang]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || isTyping) return;

    const userMsg: Message = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate thinking delay
    await new Promise(r => setTimeout(r, 600 + Math.random() * 800));

    const ctx = buildContext(financeSummary, macroData, lang);
    const reply = generateResponse(message, ctx, messages);

    setMessages(prev => [...prev, {
      role: "assistant",
      content: reply,
      timestamp: new Date().toISOString(),
    }]);
    setIsTyping(false);
    inputRef.current?.focus();
  };

  const clearChat = () => {
    setMessages([]);
    setLang(l => {
      const same = l;
      return same;
    });
    // Re-trigger greeting
    setTimeout(() => {
      const name = localStorage.getItem("econome_name")?.split(" ")[0] || "there";
      setMessages([{
        role: "assistant",
        content: `Hi ${name}! Chat cleared. What would you like to understand today?`,
        timestamp: new Date().toISOString(),
      }]);
    }, 100);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">🤖</div>
          <div>
            <h1 className="font-bold text-gray-900 text-sm">{t.title}</h1>
            <p className="text-xs text-gray-400">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 bg-green-50 border border-green-100 rounded-lg px-2 py-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-600">Context loaded</span>
          </div>
          <select value={lang}
            onChange={e => { const l = e.target.value as any; setLang(l); localStorage.setItem("econome_lang", l); }}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none">
            <option value="en">EN</option>
            <option value="hi">हिं</option>
            <option value="mr">मरा</option>
          </select>
          <button onClick={clearChat}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">
            {t.clear}
          </button>
        </div>
      </div>

      {/* Live context banner */}
      <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-indigo-700 font-medium">📊 {t.context}:</span>
        {financeSummary?.savings_rate !== undefined && (
          <span className="text-xs bg-white border border-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
            Savings: {(financeSummary.savings_rate * 100).toFixed(1)}%
          </span>
        )}
        {macroData?.REPO_RATE?.value && (
          <span className="text-xs bg-white border border-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
            Repo: {macroData.REPO_RATE.value}%
          </span>
        )}
        {macroData?.CPI_INDIA?.value && (
          <span className="text-xs bg-white border border-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
            CPI: {macroData.CPI_INDIA.value}%
          </span>
        )}
        {macroData?.USD_INR?.value && (
          <span className="text-xs bg-white border border-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
            ₹/$: {macroData.USD_INR.value.toFixed(1)}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
        {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
        {isTyping && <TypingIndicator text={t.typing} />}
        <div ref={bottomRef} />
      </div>

      {/* Starters */}
      {messages.length <= 1 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">{t.suggested}</p>
          <div className="flex flex-wrap gap-2">
            {starters.map(s => (
              <button key={s} onClick={() => sendMessage(s)}
                className="text-xs bg-white border border-indigo-200 text-indigo-600 rounded-full px-3 py-1.5 hover:bg-indigo-50 transition">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-4 py-3">
        {messages.length > 1 && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
            {(t.quick as string[]).map((s: string) => (
              <button key={s} onClick={() => sendMessage(s)} disabled={isTyping}
                className="text-xs bg-gray-100 text-gray-600 rounded-full px-3 py-1 whitespace-nowrap hover:bg-indigo-100 hover:text-indigo-700 flex-shrink-0 transition disabled:opacity-40">
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input ref={inputRef}
            className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder={t.placeholder}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            disabled={isTyping} />
          <button title="Voice input (coming soon)"
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 flex-shrink-0">
            🎤
          </button>
          <button onClick={() => sendMessage()} disabled={!input.trim() || isTyping}
            className="bg-indigo-600 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition flex-shrink-0 text-lg">
            ↑
          </button>
        </div>
        <p className="text-xs text-gray-300 text-center mt-2">{t.disclaimer}</p>
      </div>
    </div>
  );
};

export default TutorChat;
