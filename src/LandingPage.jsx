import React, { useEffect, useState } from 'react';

export default function LandingPage({ onGetStarted }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-slate-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed w-full z-50 top-0 transition-all duration-300 bg-[#0a0f1c]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/20">
              🎯
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Students Activity Tracker <span className="text-indigo-400 text-sm tracking-widest uppercase ml-1">Institutes</span>
            </span>
          </div>
          <button 
            onClick={onGetStarted}
            className="group relative px-6 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/50 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300" />
            <span className="relative text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
              Login / Dashboard
            </span>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6">
        {/* Abstract Background Elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className={`max-w-5xl mx-auto text-center transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            The Future of Academy Management
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
            Stop Guessing.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              Start Guiding.
            </span>
          </h1>
          
          <p className="text-lg lg:text-2xl text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed">
            Relying on intuition costs you selections. Equip your institute with <strong className="text-white">objective, real-time data</strong> on every aspirant's performance, weaknesses, and daily habits. 
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={onGetStarted}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-bold shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_0_60px_-15px_rgba(79,70,229,0.7)] hover:-translate-y-1 transition-all duration-300"
            >
              Supercharge Your Institute 🚀
            </button>
            <a 
              href="https://wa.me/?text=I%20want%20to%20understand%20Students%20Activity%20Tracker%20for%20institutes!%20Can%20we%20discuss%3F"
              target="_blank" rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-center text-lg font-bold transition-all duration-300 backdrop-blur-sm flex items-center justify-center"
            >
              Book a Demo
            </a>
          </div>
          
          <p className="mt-6 text-sm text-slate-500 font-medium">No credit card required. Onboard your first cohort in minutes.</p>
        </div>
      </section>

      {/* Pain Points vs Solution (The "Why") */}
      <section className="py-24 px-6 relative z-10 bg-slate-900/50 border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-bold mb-6">The Old Way is <span className="text-rose-400">Failing</span> Your Students</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">In a competition where margins are razor-thin, subjective feedback isn't enough. You need absolute clarity.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "blind",
                title: "Subjective Mentorship",
                problem: "Mentors rely on gut feeling or brief interactions to gauge a student's standing.",
                solution: "Objective metrics across GS, Optional, and CSAT. Know exactly where they stand."
              },
              {
                icon: "chart-line-down",
                title: "Hidden Weaknesses",
                problem: "Students consistently fail in specific sub-topics, but it goes unnoticed until the actual exam.",
                solution: "Granular topic tracking. Spot patterns of failure weeks before the Prelims."
              },
              {
                icon: "clock",
                title: "Operational Drag",
                problem: "Instructors waste hundreds of hours manually reviewing disparate excel sheets and test scores.",
                solution: "Automated aggregation. One centralized dashboard for the entire cohort."
              }
            ].map((feature, idx) => (
              <div key={idx} className="group p-8 rounded-3xl bg-slate-900 border border-white/5 hover:border-indigo-500/30 transition-all duration-500 hover:-translate-y-2 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="text-xl font-bold text-white mb-4">{feature.title}</div>
                  <div className="mb-4">
                    <span className="text-rose-400 text-xs font-bold uppercase tracking-wider mb-1 block">The Problem</span>
                    <p className="text-slate-400 text-sm leading-relaxed">{feature.problem}</p>
                  </div>
                  <div>
                    <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1 block">Our Solution</span>
                    <p className="text-slate-200 text-sm leading-relaxed">{feature.solution}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Deep Dive */}
      <section className="py-32 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-32">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-2xl mb-6">🎯</div>
              <h3 className="text-3xl lg:text-4xl font-bold mb-6">Laser-Focused Mentorship</h3>
              <p className="text-slate-400 text-lg leading-relaxed mb-8">
                Identify precisely where a candidate is struggling—be it Art & Culture, Ethics case studies, or CSAT reasoning—and intervene before it's too late. 
                <br /><br />
                Provide hyper-personalized feedback that actually translates to higher marks. 
              </p>
              <ul className="space-y-4">
                {['Micro-topic performance tracking', 'Answer writing consistency alerts', 'Custom intervention triggers'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300 font-medium">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">✓</div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-3xl" />
              <div className="relative bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden glass">
                <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/5">
                  <div>
                    <div className="text-white font-bold text-lg">Ramesh Kumar</div>
                    <div className="text-slate-400 text-sm">GS Paper 2 - Weakness Detected</div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold border border-rose-500/30">Action Required</div>
                </div>
                <div className="space-y-3">
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 w-[35%]" />
                  </div>
                  <p className="text-xs text-slate-400">Polity (Governance): 35% accuracy in last 4 mocks</p>
                </div>
                <button className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white transition-colors">
                  Assign Remedial Material
                </button>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 blur-3xl" />
              <div className="relative bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl glass">
                 <div className="flex items-center gap-4 mb-6">
                   <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white text-sm">C-A</div>
                   <div>
                     <div className="text-white font-bold text-lg">Foundation Batch 2026</div>
                     <div className="text-slate-400 text-sm">450 Students • 85% Active</div>
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                     <div className="text-slate-400 text-xs uppercase mb-1">Avg Test Score</div>
                     <div className="text-2xl font-bold text-emerald-400">+12%</div>
                   </div>
                   <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                     <div className="text-slate-400 text-xs uppercase mb-1">At Risk</div>
                     <div className="text-2xl font-bold text-rose-400">24</div>
                   </div>
                 </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-2xl mb-6">📊</div>
              <h3 className="text-3xl lg:text-4xl font-bold mb-6">Proof of Performance</h3>
              <p className="text-slate-400 text-lg leading-relaxed mb-8">
                Build unwavering trust with candidates and parents. Show them undeniable, visual proof of progress and your institute's active role in their journey.
              </p>
              <ul className="space-y-4">
                {['Automated progress reports', 'Cohort-wide analytics', 'Retention-boosting transparency'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300 font-medium">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">✓</div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-indigo-900/20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[500px] bg-gradient-to-r from-indigo-500/30 to-purple-500/30 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10 p-12 rounded-3xl bg-slate-900/40 border border-white/10 backdrop-blur-xl shadow-2xl">
          <h2 className="text-4xl md:text-6xl font-extrabold mb-6">Your Competitors Are Upgrading. <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Are You?</span></h2>
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Stop losing top ranks to institutes that leverage data. Give your mentors the tools they need to produce Toppers.
          </p>
          <a 
            href="https://wa.me/?text=I%20want%20to%20understand%20Students%20Activity%20Tracker%20for%20institutes!%20Can%20we%20discuss%3F"
            target="_blank" rel="noopener noreferrer"
            className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-white text-indigo-950 text-center text-lg font-extrabold shadow-xl hover:scale-105 hover:shadow-2xl transition-all duration-300 inline-block"
          >
            Claim Your Institute Profile Now
          </a>
          <p className="mt-6 text-slate-400 text-sm">Join the elite club of data-driven academies.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 text-center text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} Students Activity Tracker for Institutes. All rights reserved.</p>
      </footer>
    </div>
  );
}
