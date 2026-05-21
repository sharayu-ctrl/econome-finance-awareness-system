import React, { useState, useEffect, useRef } from "react";
import { useLiveMacro } from "../lib/api";

// ── Language ──────────────────────────────────────────────────────────────────
const LANG_LABELS: Record<string, Record<string, string>> = {
  en: {
    title: "Economy",
    subtitle: "Live markets, rates & economic trends · Tap any card for AI explanation",
    markets: "Live Market Indices",
    indicators: "Key Economic Indicators",
    global: "🌍 Global Factor Today",
    globalSub: "How the world affects your wallet",
    tapHint: "Tap for AI explanation →",
    loading: "Fetching live data...",
    generating: "Generating AI explanation...",
    keyTakeaway: "📌 Key Takeaway for You",
    close: "Close",
    language: "Language",
    intraday: "Intraday Performance",
    updatedLive: "Live · Updates every 60s",
    changeIn: "Change",
    crudeOil: "Crude Oil",
    crudeHighMsg: "India imports ~85% of crude oil. At this price level, petrol prices may rise ₹2–4/litre within 2–3 weeks. Transport and food delivery costs will follow.",
    crudeLowMsg: "Crude oil is within a comfortable range for India. Petrol prices are expected to remain stable. LPG cylinder prices are unlikely to change this month.",
  },
  hi: {
    title: "अर्थव्यवस्था",
    subtitle: "लाइव बाज़ार, दरें और आर्थिक रुझान · AI स्पष्टीकरण के लिए टैप करें",
    markets: "लाइव बाज़ार सूचकांक",
    indicators: "मुख्य आर्थिक संकेतक",
    global: "🌍 आज का वैश्विक कारक",
    globalSub: "दुनिया आपकी जेब को कैसे प्रभावित करती है",
    tapHint: "AI स्पष्टीकरण के लिए टैप करें →",
    loading: "लाइव डेटा प्राप्त हो रहा है...",
    generating: "AI स्पष्टीकरण तैयार हो रहा है...",
    keyTakeaway: "📌 आपके लिए मुख्य बात",
    close: "बंद करें",
    language: "भाषा",
    intraday: "इंट्राडे प्रदर्शन",
    updatedLive: "लाइव · हर 60 सेकंड में अपडेट",
    changeIn: "बदलाव",
    crudeOil: "कच्चा तेल",
    crudeHighMsg: "भारत ~85% कच्चा तेल आयात करता है। इस कीमत पर पेट्रोल 2-4 रुपये/लीटर बढ़ सकता है।",
    crudeLowMsg: "कच्चा तेल भारत के लिए सामान्य सीमा में है। पेट्रोल की कीमतें स्थिर रहने की उम्मीद है।",
  },
  mr: {
    title: "अर्थव्यवस्था",
    subtitle: "लाइव बाजार, दर आणि आर्थिक ट्रेंड · AI स्पष्टीकरणासाठी टॅप करा",
    markets: "लाइव बाजार निर्देशांक",
    indicators: "मुख्य आर्थिक निर्देशक",
    global: "🌍 आजचा जागतिक घटक",
    globalSub: "जग तुमच्या खिशावर कसा परिणाम करते",
    tapHint: "AI स्पष्टीकरणासाठी टॅप करा →",
    loading: "लाइव डेटा मिळवत आहे...",
    generating: "AI स्पष्टीकरण तयार होत आहे...",
    keyTakeaway: "📌 तुमच्यासाठी मुख्य निष्कर्ष",
    close: "बंद करा",
    language: "भाषा",
    intraday: "इंट्राडे कामगिरी",
    updatedLive: "लाइव · दर 60 सेकंदांनी अपडेट",
    changeIn: "बदल",
    crudeOil: "कच्चे तेल",
    crudeHighMsg: "भारत ~85% कच्चे तेल आयात करतो. या किमतीवर पेट्रोल 2-4 रु/लिटर वाढू शकते.",
    crudeLowMsg: "कच्चे तेल भारतासाठी सामान्य पातळीत आहे. पेट्रोलच्या किमती स्थिर राहतील अशी अपेक्षा आहे.",
  },
};

// ── SVG Line Chart ────────────────────────────────────────────────────────────
const LineChart = ({
  data,
  color = "#10b981",
  label,
}: {
  data: { time: string; value: number }[];
  color?: string;
  label: string;
}) => {
  const [hover, setHover] = useState<{ x: number; y: number; value: number; time: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!data || data.length < 2) return (
    <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
      No chart data available
    </div>
  );

  const values = data.map(d => d.value);
  const min = Math.min(...values) * 0.9995;
  const max = Math.max(...values) * 1.0005;
  const range = max - min || 1;
  const W = 600; const H = 180;
  const pad = { top: 15, bottom: 35, left: 55, right: 15 };

  const cx = (i: number) => pad.left + (i / (data.length - 1)) * (W - pad.left - pad.right);
  const cy = (v: number) => pad.top + (1 - (v - min) / range) * (H - pad.top - pad.bottom);

  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"} ${cx(i).toFixed(1)} ${cy(d.value).toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${cx(data.length - 1).toFixed(1)} ${(H - pad.bottom).toFixed(1)} L ${cx(0).toFixed(1)} ${(H - pad.bottom).toFixed(1)} Z`;

  const yTicks = 4;
  const xTicks = data.filter((_, i) => i % Math.floor(data.length / 5) === 0);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((relX - pad.left) / (W - pad.left - pad.right)) * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setHover({ x: cx(clamped), y: cy(data[clamped].value), value: data[clamped].value, time: data[clamped].time });
  };

  return (
    <div className="relative">
      {hover && (
        <div className="absolute top-2 right-2 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg z-10">
          {hover.time} · {label.includes("₹") || label.includes("INR") ? "₹" : label.includes("$") ? "$" : ""}{hover.value.toFixed(2)}
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 180 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {Array.from({ length: yTicks }).map((_, i) => {
          const v = min + (range * i) / (yTicks - 1);
          return (
            <g key={i}>
              <line x1={pad.left} y1={cy(v)} x2={W - pad.right} y2={cy(v)} stroke="#f3f4f6" strokeWidth="1" />
              <text x={pad.left - 4} y={cy(v) + 4} textAnchor="end" style={{ fontSize: 9, fill: "#9ca3af" }}>
                {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(2)}
              </text>
            </g>
          );
        })}
        {xTicks.map((d, i) => (
          <text key={i} x={cx(data.indexOf(d))} y={H - 8} textAnchor="middle" style={{ fontSize: 9, fill: "#9ca3af" }}>
            {d.time}
          </text>
        ))}
        <path d={areaD} fill={`url(#grad-${label})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {hover && (
          <>
            <line x1={hover.x} y1={pad.top} x2={hover.x} y2={H - pad.bottom} stroke={color} strokeWidth="1" strokeDasharray="3,3" />
            <circle cx={hover.x} cy={hover.y} r="4" fill={color} stroke="white" strokeWidth="2" />
          </>
        )}
      </svg>
    </div>
  );
};

// ── Generate chart data ───────────────────────────────────────────────────────
const generateChart = (base: number, volatility = 0.002) => {
  const points: { time: string; value: number }[] = [];
  let val = base * 0.993;
  for (let i = 0; i <= 25; i++) {
    val = val + (Math.random() - 0.42) * base * volatility;
    const hour = 9 + Math.floor((i * 15) / 60);
    const min = (i * 15) % 60;
    points.push({ time: `${hour}:${min.toString().padStart(2, "0")}`, value: parseFloat(val.toFixed(4)) });
  }
  return points;
};

// ── AI Explanation Modal ──────────────────────────────────────────────────────
const AIModal = ({
  indicator,
  lang,
  t,
  onClose,
}: {
  indicator: any;
  lang: string;
  t: Record<string, string>;
  onClose: () => void;
}) => {
  const [explanation, setExplanation] = useState("");
  const [takeaway, setTakeaway] = useState("");
  const [loading, setLoading] = useState(true);
  const [chartData] = useState(() =>
    generateChart(
      typeof indicator.rawValue === "number" ? indicator.rawValue : 22500,
      indicator.volatility ?? 0.002
    )
  );

  useEffect(() => {
    const langName = lang === "en" ? "English" : lang === "hi" ? "Hindi" : "Marathi";
    const prompt = `You are EconoMe, an AI financial awareness assistant for Indian households.

Explain the following economic indicator in simple, friendly language in ${langName}:

Indicator: ${indicator.label}
Current Value: ${indicator.displayValue}
Change: ${indicator.change}
Context: India-specific financial impact

Write TWO sections:
1. EXPLANATION (3-4 sentences): What this indicator means, why it moves, and how it works in India's context. Use simple language, no jargon.
2. TAKEAWAY (1-2 sentences): One specific, actionable thing this person should know or do RIGHT NOW given this value.

Format your response exactly as:
EXPLANATION: [your explanation here]
TAKEAWAY: [your takeaway here]

Keep it conversational, warm, and India-specific. Use ₹ for currency. Mention RBI, EMI, petrol, or grocery prices where relevant.`;

    const fetchExplanation = async () => {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        const data = await response.json();
        const text = data.content?.[0]?.text || "";
        const expMatch = text.match(/EXPLANATION:\s*([\s\S]*?)(?=TAKEAWAY:|$)/i);
        const takeMatch = text.match(/TAKEAWAY:\s*([\s\S]*?)$/i);
        setExplanation(expMatch?.[1]?.trim() || text);
        setTakeaway(takeMatch?.[1]?.trim() || "");
      } catch {
        setExplanation(
          lang === "en"
            ? `${indicator.label} is currently at ${indicator.displayValue}. This indicator directly impacts your daily finances in India.`
            : lang === "hi"
            ? `${indicator.label} वर्तमान में ${indicator.displayValue} पर है। यह संकेतक भारत में आपके दैनिक वित्त को प्रभावित करता है।`
            : `${indicator.label} सध्या ${indicator.displayValue} आहे. हे सूचक भारतातील तुमच्या दैनंदिन वित्तावर परिणाम करते.`
        );
        setTakeaway("");
      }
      setLoading(false);
    };

    fetchExplanation();
  }, [indicator.label, lang]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-start rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{indicator.icon}</span>
              <h2 className="font-bold text-gray-900 text-lg">{indicator.label}</h2>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-bold text-2xl text-gray-900">{indicator.displayValue}</span>
              <span className={`text-sm font-semibold ${indicator.changeColor}`}>{indicator.change}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">×</button>
        </div>

        <div className="px-6 pt-4">
          <p className="text-xs text-gray-400 mb-2">{t.intraday}</p>
          <LineChart data={chartData} color={indicator.chartColor ?? "#10b981"} label={indicator.label} />
        </div>

        <div className="px-6 pt-2">
          <div className="flex items-center gap-2 bg-indigo-50 rounded-xl px-3 py-2 w-fit">
            <span className="text-xs">🤖</span>
            <span className="text-xs font-medium text-indigo-700">Generative AI + XAI · Real-time explanation</span>
          </div>
        </div>

        <div className="px-6 py-4">
          {loading ? (
            <div className="space-y-3">
              <div className="animate-pulse bg-gray-100 rounded h-4 w-full" />
              <div className="animate-pulse bg-gray-100 rounded h-4 w-5/6" />
              <div className="animate-pulse bg-gray-100 rounded h-4 w-4/6" />
              <div className="animate-pulse bg-gray-100 rounded h-4 w-full" />
              <p className="text-xs text-indigo-500 text-center mt-2 animate-pulse">{t.generating}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed">{explanation}</p>
          )}
        </div>

        {!loading && takeaway && (
          <div className="px-6 pb-6">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 mb-1">{t.keyTakeaway}</p>
              <p className="text-sm text-amber-800">{takeaway}</p>
            </div>
          </div>
        )}

        <div className="px-6 pb-6">
          <button onClick={onClose}
            className="w-full border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm hover:bg-gray-50">
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Economy Page ─────────────────────────────────────────────────────────
const EconomyPage: React.FC = () => {
  const { data: liveData, isLoading } = useLiveMacro();
  const [selected, setSelected] = useState<any>(null);
  const [lang, setLang] = useState<"en" | "hi" | "mr">(() => {
    const saved = localStorage.getItem("econome_lang");
    return (saved === "en" || saved === "hi" || saved === "mr") ? saved : "en";
  });

  const t = LANG_LABELS[lang] ?? LANG_LABELS["en"];

  const usdInr = liveData?.USD_INR?.value ?? 83.62;
  const cpi = liveData?.CPI_INDIA?.value ?? 5.4;
  const repoRate = liveData?.REPO_RATE?.value ?? 6.5;
  const crude = liveData?.CRUDE_OIL?.value ?? 82.4;
  const nifty = liveData?.NIFTY50?.value ?? 22530;
  const sensex = nifty * 2.95;

  const marketCards = [
    {
      label: "NIFTY 50",
      displayValue: nifty.toLocaleString("en-IN", { maximumFractionDigits: 2 }),
      rawValue: nifty,
      change: "+0.62%",
      changeColor: "text-green-600",
      icon: "📊",
      chartColor: "#10b981",
      volatility: 0.002,
      description: "NSE benchmark · Top 50 companies",
    },
    {
      label: "SENSEX",
      displayValue: Math.round(sensex).toLocaleString("en-IN"),
      rawValue: sensex,
      change: "+0.58%",
      changeColor: "text-green-600",
      icon: "📈",
      chartColor: "#10b981",
      volatility: 0.002,
      description: "BSE benchmark · Top 30 companies",
    },
    {
      label: "USD / INR",
      displayValue: `₹${usdInr.toFixed(2)}`,
      rawValue: usdInr,
      change: usdInr > 84 ? "-0.12%" : "+0.08%",
      changeColor: usdInr > 84 ? "text-red-500" : "text-green-600",
      icon: "💱",
      chartColor: usdInr > 84 ? "#ef4444" : "#10b981",
      volatility: 0.0003,
      description: "Rupee vs US Dollar · Live rate",
    },
    {
      label: "Crude Oil",
      displayValue: `$${crude.toFixed(1)}/bbl`,
      rawValue: crude,
      change: crude > 85 ? "+1.2%" : "-0.4%",
      changeColor: crude > 85 ? "text-red-500" : "text-green-600",
      icon: "🛢️",
      chartColor: crude > 85 ? "#ef4444" : "#10b981",
      volatility: 0.005,
      description: "Brent crude · Global benchmark",
    },
  ];

  const macroIndicators = [
    {
      label: "CPI Inflation",
      displayValue: `${cpi.toFixed(1)}%`,
      rawValue: cpi,
      plain: cpi > 6 ? "Rising fast" : cpi > 4 ? "Rising" : "Stable",
      direction: cpi > 5 ? "↑" : "→",
      change: `${cpi.toFixed(1)}% YoY`,
      changeColor: cpi > 5 ? "text-red-500" : "text-amber-500",
      color: cpi > 6 ? "text-red-600" : cpi > 4 ? "text-amber-600" : "text-green-600",
      bg: cpi > 6 ? "bg-red-50 border-red-100" : cpi > 4 ? "bg-amber-50 border-amber-100" : "bg-green-50 border-green-100",
      chartColor: cpi > 5 ? "#ef4444" : "#f59e0b",
      volatility: 0.001,
      icon: "📊",
      description: "Consumer price index · Everyday prices",
    },
    {
      label: "Repo Rate",
      displayValue: `${repoRate.toFixed(2)}%`,
      rawValue: repoRate,
      plain: "Stable",
      direction: "→",
      change: "RBI Policy",
      changeColor: "text-amber-500",
      color: "text-amber-600",
      bg: "bg-amber-50 border-amber-100",
      chartColor: "#f59e0b",
      volatility: 0.0001,
      icon: "🏦",
      description: "RBI lending rate · Affects EMIs & FDs",
    },
    {
      label: "Market Sentiment",
      displayValue: "Cautiously Positive",
      rawValue: nifty,
      plain: "Positive",
      direction: "↑",
      change: "Bullish bias",
      changeColor: "text-green-600",
      color: "text-green-600",
      bg: "bg-green-50 border-green-100",
      chartColor: "#10b981",
      volatility: 0.003,
      icon: "🌡️",
      description: "Overall investor mood · Indian markets",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header + Language Selector */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
          <p className="text-gray-400 text-sm">{t.subtitle}</p>
          {!isLoading && (
            <div className="flex items-center gap-1 mt-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-600">{t.updatedLive}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{t.language}:</span>
          <select
            value={lang}
            onChange={e => {
              const val = e.target.value as "en" | "hi" | "mr";
              setLang(val);
              localStorage.setItem("econome_lang", val);
            }}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="mr">मराठी</option>
          </select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-8 text-gray-400">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full mx-auto mb-3" />
          <p className="text-sm">{t.loading}</p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Market Cards */}
          <h2 className="font-bold text-gray-800 mb-3">{t.markets}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {marketCards.map(card => (
              <button
                key={card.label}
                onClick={() => setSelected(card)}
                className="bg-white rounded-2xl border border-gray-100 p-4 text-left hover:border-indigo-300 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs text-gray-500 font-medium">{card.label}</span>
                  <span className="text-lg">{card.icon}</span>
                </div>
                <p className="font-bold text-gray-900 text-xl mb-0.5">{card.displayValue}</p>
                <p className={`text-sm font-semibold ${card.changeColor}`}>{card.change}</p>
                <p className="text-xs text-gray-400 mt-1">{card.description}</p>
                <p className="text-xs text-indigo-400 mt-2">{t.tapHint}</p>
              </button>
            ))}
          </div>

          {/* Macro Indicators */}
          <h2 className="font-bold text-gray-800 mb-3">{t.indicators}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {macroIndicators.map(ind => (
              <button
                key={ind.label}
                onClick={() => setSelected(ind)}
                className={`rounded-2xl border p-4 text-left hover:shadow-md transition-all ${ind.bg}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-2xl">{ind.icon}</span>
                  <span className={`text-sm font-bold ${ind.changeColor}`}>{ind.change}</span>
                </div>
                <p className="font-bold text-gray-900">{ind.label}</p>
                <p className="text-xs text-gray-500 mb-2">{ind.description}</p>
                <div className="flex justify-between items-center">
                  <span className={`font-bold text-xl ${ind.color}`}>{ind.displayValue}</span>
                  <span className={`text-lg font-bold ${ind.color}`}>{ind.direction}</span>
                </div>
                <p className="text-xs text-indigo-500 mt-2">{t.tapHint}</p>
              </button>
            ))}
          </div>

          {/* Global Factor */}
          <div
            className="bg-gray-900 rounded-2xl p-5 text-white cursor-pointer hover:bg-gray-800 transition"
            onClick={() => setSelected({
              label: "Crude Oil",
              displayValue: `$${crude.toFixed(1)}/bbl`,
              rawValue: crude,
              change: crude > 85 ? "+1.2%" : "-0.4%",
              changeColor: crude > 85 ? "text-red-400" : "text-green-400",
              icon: "🛢️",
              chartColor: crude > 85 ? "#ef4444" : "#10b981",
              volatility: 0.005,
            })}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-lg">{t.global}</h3>
                <p className="text-gray-400 text-xs">{t.globalSub}</p>
              </div>
              <span className="text-3xl">🛢️</span>
            </div>
            <p className="text-amber-300 font-semibold text-lg mb-2">
              {t.crudeOil} · ${crude.toFixed(1)}/barrel
            </p>
            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              {crude > 85 ? t.crudeHighMsg : t.crudeLowMsg}
            </p>
            <p className="text-indigo-300 text-xs">{t.tapHint}</p>
          </div>
        </>
      )}

      {/* AI Modal */}
      {selected && (
        <AIModal
          key={selected.label}
          indicator={selected}
          lang={lang}
          t={t}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

export default EconomyPage;
