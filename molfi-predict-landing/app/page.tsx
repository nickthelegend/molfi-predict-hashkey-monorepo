'use client';

import React from 'react';
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Download, ArrowUpRight, Zap, Shield, Cpu, BarChart3, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen bg-background text-on-surface antialiased overflow-x-hidden selection:bg-primary selection:text-on-primary">
      <Navbar />

      {/* Hero Section */}
      <header className="relative pt-48 pb-24 px-6 overflow-hidden flex flex-col items-center text-center">
        {/* Top Badge */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.3em] mb-12"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          ZK-Private · Agent-Native · HashKey Chain
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-[5.5rem] font-black tracking-[-0.04em] mb-8 leading-[1.0] font-headline max-w-4xl"
        >
          Bet in <span className="text-primary italic">private</span>. <br /> Prove it on-chain.
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-on-surface-variant text-lg md:text-xl font-medium max-w-2xl mb-12 leading-relaxed"
        >
          Molfi is private, agent-native prediction markets on HashKey Chain. Bet on real-world outcomes — your YES/NO side stays hidden behind a commitment, and you claim winnings with a zero-knowledge proof, unlinkable to your bet.
        </motion.p>

        {/* CTA Button */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Link 
            href="/download"
            className="bg-primary text-on-primary px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 primary-glow hover:opacity-90 active:scale-95 transition-all mb-24"
          >
            <Download size={18} />
            Place a Private Bet
          </Link>
        </motion.div>

        {/* Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-primary/5 rounded-full blur-[150px] pointer-events-none -z-10 animate-pulse duration-[10s]" />
      </header>

      {/* Grid Section */}
      <section className="px-6 pb-48 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Feature 1: Molfi Extension (Large Top Card) */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-2 group relative h-[500px] md:h-[600px] bg-surface-container rounded-[2.5rem] overflow-hidden border border-outline-variant/10 hover:border-primary/20 transition-colors"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
            <div className="relative z-10 p-12 h-full flex flex-col justify-end">
              <div className="max-w-md">
                <h3 className="text-3xl font-black text-white mb-4 tracking-tight flex items-center gap-3">
                  Confidential Bets <ArrowUpRight className="text-on-surface-variant group-hover:text-primary transition-colors" />
                </h3>
                <p className="text-on-surface-variant font-medium leading-relaxed">
                  Your YES/NO side stays hidden on-chain behind a commitment. At settlement the contract injects the resolved winner as a public input, so losing notes can't prove — and you claim with a zero-knowledge proof that's unlinkable to your bet.
                </p>
              </div>
            </div>
            {/* Image Placeholder */}
            <div className="absolute top-12 left-12 right-12 bottom-48 bg-black/40 rounded-3xl border border-white/5 flex items-center justify-center overflow-hidden">
               <span className="text-white/10 font-black uppercase tracking-widest text-sm">Confidential Bet · Side Hidden</span>
               {/* Decorative elements to look like a UI */}
               <div className="absolute top-4 left-4 right-4 h-8 bg-white/5 rounded-lg flex items-center px-4 gap-2">
                 <div className="w-2 h-2 rounded-full bg-red-500/50" />
                 <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                 <div className="w-2 h-2 rounded-full bg-green-500/50" />
               </div>
            </div>
          </motion.div>

          {/* Feature 2: Molfi Mobile App */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="group relative h-[600px] bg-surface-container rounded-[2.5rem] overflow-hidden border border-outline-variant/10 hover:border-primary/20 transition-colors"
          >
            <div className="relative z-10 p-12 h-full flex flex-col justify-end">
              <h3 className="text-3xl font-black text-white mb-4 tracking-tight flex items-center gap-3">
                ZK-Gated Betting <ArrowUpRight className="text-on-surface-variant group-hover:text-primary transition-colors" />
              </h3>
              <p className="text-on-surface-variant font-medium leading-relaxed">
                Prove you're solvent — hidden collateral above the threshold — with a single-use nullifier. No one sees your balance, and no bet can be replayed. BN254 Groth16, verified on-chain.
              </p>
            </div>
            {/* Image Placeholder */}
            <div className="absolute top-12 left-12 right-12 bottom-48 bg-black/40 rounded-3xl border border-white/5 flex items-center justify-center">
               <span className="text-white/10 font-black uppercase tracking-widest text-sm text-center px-8">Solvency Proof · Nullifier</span>
            </div>
          </motion.div>

          {/* Feature 3: Agentic Wallet */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="group relative h-[600px] bg-surface-container rounded-[2.5rem] overflow-hidden border border-outline-variant/10 hover:border-primary/20 transition-colors"
          >
            <div className="relative z-10 p-12 h-full flex flex-col justify-end">
              <h3 className="text-3xl font-black text-white mb-4 tracking-tight flex items-center gap-3">
                Agent-Native <ArrowUpRight className="text-on-surface-variant group-hover:text-primary transition-colors" />
              </h3>
              <p className="text-on-surface-variant font-medium leading-relaxed">
                An AI agent reads one SKILL.md, spins up a wallet, funds itself, places a ZK-verified bet, and redeems — no human in the loop. Ships with a TypeScript SDK and an MCP server.
              </p>
            </div>
            {/* Image Placeholder */}
            <div className="absolute top-12 left-12 right-12 bottom-48 bg-black/40 rounded-3xl border border-white/5 flex items-center justify-center">
               <span className="text-white/10 font-black uppercase tracking-widest text-sm text-center px-8">SKILL.md · SDK · MCP Server</span>
            </div>
          </motion.div>

          {/* Feature 4: Research AI */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="group relative h-[500px] bg-surface-container rounded-[2.5rem] overflow-hidden border border-outline-variant/10 hover:border-primary/20 transition-colors"
          >
            <div className="relative z-10 p-12 h-full flex flex-col justify-end">
              <h3 className="text-3xl font-black text-white mb-4 tracking-tight flex items-center gap-3">
                Privacy Pool <ArrowUpRight className="text-on-surface-variant group-hover:text-primary transition-colors" />
              </h3>
              <p className="text-on-surface-variant font-medium leading-relaxed">
                Deposit into a Poseidon Merkle tree and withdraw with a membership proof and a nullifier. Shielded in, shielded out — the link between deposit and withdrawal never touches the chain.
              </p>
            </div>
            {/* Image Placeholder */}
            <div className="absolute top-12 left-12 right-12 bottom-48 bg-black/40 rounded-3xl border border-white/5 flex items-center justify-center">
               <BarChart3 className="text-white/5" size={100} />
            </div>
          </motion.div>

          {/* Feature 5: Built for Speed */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="group relative h-[500px] bg-surface-container rounded-[2.5rem] overflow-hidden border border-outline-variant/10 hover:border-primary/20 transition-colors"
          >
            <div className="relative z-10 p-12 h-full flex flex-col justify-end">
              <h3 className="text-3xl font-black text-white mb-4 tracking-tight flex items-center gap-3">
                A Venue That Runs Itself <ArrowUpRight className="text-on-surface-variant group-hover:text-primary transition-colors" />
              </h3>
              <p className="text-on-surface-variant font-medium leading-relaxed">
                Real mUSDC escrow and pari-mutuel payouts, with a keeper that auto-rolls 15m/30m crypto markets settled by an on-chain price oracle. No operator, no off-chain trust.
              </p>
            </div>
            {/* Image Placeholder */}
            <div className="absolute top-12 left-12 right-12 bottom-48 bg-black/40 rounded-3xl border border-white/5 flex items-center justify-center">
               <Zap className="text-white/5" size={100} />
            </div>
          </motion.div>

        </div>
      </section>

      {/* Values Section */}
      <section className="py-48 bg-surface-container-low border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-24">
           <div className="space-y-6">
             <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
               <Shield size={32} />
             </div>
             <h4 className="text-2xl font-black text-white">Private by Proof</h4>
             <p className="text-on-surface-variant font-medium leading-relaxed">
               Three real ZK mechanisms — gated bet, confidential bet, and privacy pool — all verified on-chain through HashKey's alt_bn128 precompiles (BN254 Groth16). Your side stays hidden; your proof is public.
             </p>
           </div>
           <div className="space-y-6">
             <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
               <Cpu size={32} />
             </div>
             <h4 className="text-2xl font-black text-white">Agent-Native by Design</h4>
             <p className="text-on-surface-variant font-medium leading-relaxed">
               One SKILL.md, a TypeScript SDK, and an MCP server let an autonomous agent fund a wallet, bet, prove, and redeem end-to-end — no human in the loop.
             </p>
           </div>
           <div className="space-y-6">
             <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
               <Globe size={32} />
             </div>
             <h4 className="text-2xl font-black text-white">HSP-Settled on HashKey Chain</h4>
             <p className="text-on-surface-variant font-medium leading-relaxed">
               Payments run on HSP (HashKey Settlement Protocol): an agent pays a verifiable micro-fee through an x402 paywall to unlock the ZK proof service, settled zero-custody on HashKey Chain (testnet, chainId 133).
             </p>
           </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}