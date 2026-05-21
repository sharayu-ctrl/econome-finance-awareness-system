import React from "react";
import { useNavigate } from "react-router-dom";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center">
            <span className="text-white text-xs font-bold">E</span>
          </div>
          <span className="font-bold text-gray-900 text-lg">EconoMe</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/login")}
            className="text-gray-600 hover:text-gray-900 text-sm font-medium"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate("/register")}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center text-center px-4 pt-24 pb-16">
        <span className="bg-green-100 text-green-700 text-xs font-medium px-3 py-1 rounded-full mb-6 flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
          AI-Powered Finance
        </span>
        <h1 className="text-5xl font-extrabold text-gray-900 leading-tight mb-6">
          Your finances,<br />intelligently simplified
        </h1>
        <p className="text-gray-500 text-lg max-w-xl mb-10">
          EconoMe combines real-time tracking, AI insights, and personalized
          guidance to help you make smarter financial decisions at every life stage.
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => navigate("/register")}
            className="bg-gray-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-700 flex items-center gap-2"
          >
            Start for Free →
          </button>
          <button
            onClick={() => navigate("/login")}
            className="bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-50"
          >
            View Demo
          </button>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 px-8 pb-16 max-w-6xl mx-auto">
        {[
          {
            icon: "🛡️",
            title: "Security",
            desc: "Authentication, Encryption and IDS to keep your data safe and secure.",
          },
          {
            icon: "📊",
            title: "Smart Tracking",
            desc: "Real-time income and expense analytics with automated categorization in ₹.",
          },
          {
            icon: "🤖",
            title: "AI-Powered Insights",
            desc: "Personalized financial awareness, risk analysis, and counterfactual projections.",
          },
          {
            icon: "💯",
            title: "Health Score",
            desc: "Dynamic financial health scoring that adapts to your life stage and goals.",
          },
        ].map((f) => (
          <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="text-2xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
            <p className="text-gray-500 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="text-center pb-20">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to take control?</h2>
        <p className="text-gray-500 mb-6">
          Join thousands making smarter financial decisions with EconoMe.
        </p>
        <button
          onClick={() => navigate("/register")}
          className="bg-gray-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-gray-700"
        >
          Get Started →
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
