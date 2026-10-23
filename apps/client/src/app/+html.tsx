import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Runs before the first paint. It resolves the persisted theme into CSS variables,
 * so the boot screen, page canvas and browser chrome never flash the wrong mode.
 */
const THEME_BOOT_SCRIPT = `
(function () {
  try {
    var root = document.documentElement;
    var v2 = localStorage.getItem("zhijing.theme.v2");
    var v1 = localStorage.getItem("zhijing.theme.v1");
    var modes = ["claude-light","claude-dark","gemini-light","gemini-dark","linear-light","linear-dark"];
    var mode = modes.indexOf(v2) > -1
      ? v2
      : (v1 === "claude" || v1 === "gemini" || v1 === "linear") ? v1 + "-light" : "claude-light";
    var canvas = {
      "claude-light": "#FAF8F5", "claude-dark": "#121214",
      "gemini-light": "#F1F7FD", "gemini-dark": "#07141F",
      "linear-light": "#F7F4FB", "linear-dark": "#0D0914"
    }[mode];
    root.setAttribute("data-theme", mode);
    root.style.colorScheme = mode.indexOf("-dark") > -1 ? "dark" : "light";
    if (canvas) {
      root.style.setProperty("--bg-canvas", canvas);
      root.style.backgroundColor = canvas;
      var metas = document.querySelectorAll('meta[name="theme-color"]');
      for (var i = 0; i < metas.length; i++) metas[i].setAttribute("content", canvas);
    }
  } catch (error) {}
})();
`;

// Expo Router uses this file as the web HTML shell. Do not add public/index.html:
// static files in public/ are served verbatim and would shadow this template
// (no bundle script + unresolved %WEB_TITLE% placeholders).
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#FAF8F5" />
        <meta name="description" content="知径 DB：面向《数据库原理》的多智能体个性化学习系统。" />
        <title>知径 DB · 多智能体个性化数据库学习</title>
        <ScrollViewStyleReset />
        <style>{`
          :root {
            /* 1. Tactile surface hierarchy · warm paper (default = claude-light) */
            --bg-canvas: #FAF8F5;
            --bg-surface: #FFFFFF;
            --bg-elevated: #F3F0EA;
            --bg-subtle-hover: #EFECE6;
            --bg-glass: rgba(255, 255, 255, 0.88);

            /* 2. Borders and elevation */
            --border-subtle: #E6E2D8;
            --border-divider: #EDEAE2;
            --border-focus: #D97757;
            --shadow-sm: 0 1px 2px rgba(24, 24, 27, 0.03);
            --shadow-card: 0 4px 20px -2px rgba(24, 24, 27, 0.04), 0 1px 3px -1px rgba(24, 24, 27, 0.02);
            --shadow-hover: 0 8px 28px -4px rgba(24, 24, 27, 0.07);

            /* 3. Text hierarchy */
            --text-primary: #18181B;
            --text-secondary: #52525B;
            --text-muted: #8E8B82;

            /* 4. Brand and semantic data palette */
            --accent-primary: #D97757;
            --accent-hover: #C46445;
            --accent-soft: #FDF3EF;
            --accent-soft-border: #F4DED5;
            --accent-glow: rgba(217, 119, 87, 0.09);
            --accent-halo: rgba(217, 119, 87, 0.14);
            --accent-ring: rgba(217, 119, 87, 0.22);
            --accent-shadow: rgba(217, 119, 87, 0.25);
            --accent-gradient-from: #E58D6E;
            --accent-secondary: #0D9488;
            --accent-gradient: linear-gradient(135deg, #E58D6E 0%, #D97757 52%, #C46445 100%);
            --boot-hairline: rgba(24, 24, 27, 0.12);
            --color-agent: #2563EB;
            --color-agent-soft: #EFF6FF;
            --color-success: #0F9E90;
            --color-success-soft: #F0FDFA;
            --color-warning: #D97706;
            --color-warning-soft: #FFFBEB;

            /* 5. Typography and radii */
            --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            --font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, monospace;
            --radius-lg: 16px;
            --radius-md: 12px;
            --radius-sm: 8px;
            color-scheme: light;
          }
          :root[data-theme="claude-dark"] {
            --bg-canvas: #121214;
            --bg-surface: #1A1A1E;
            --bg-elevated: #26262B;
            --bg-subtle-hover: #2E2E36;
            --bg-glass: rgba(18, 18, 20, 0.9);
            --border-subtle: #2E2E36;
            --border-divider: #27272E;
            --text-primary: #F4F4F5;
            --text-secondary: #A1A1AA;
            --text-muted: #71717A;
            --accent-primary: #E07A5F;
            --accent-hover: #EC8A70;
            --accent-soft: rgba(224, 122, 95, 0.15);
            --accent-soft-border: rgba(224, 122, 95, 0.28);
            --accent-glow: rgba(224, 122, 95, 0.12);
            --accent-halo: rgba(224, 122, 95, 0.2);
            --accent-ring: rgba(224, 122, 95, 0.3);
            --accent-shadow: rgba(224, 122, 95, 0.32);
            --accent-gradient-from: #E88C6F;
            --accent-secondary: #2DD4BF;
            --accent-gradient: linear-gradient(135deg, #E88C6F 0%, #E07A5F 55%, #C46445 100%);
            --boot-hairline: rgba(244, 244, 245, 0.12);
            --border-focus: #E07A5F;
            --color-agent: #60A5FA;
            --color-agent-soft: rgba(96, 165, 250, 0.14);
            --color-success: #14B8A6;
            --color-success-soft: rgba(20, 184, 166, 0.14);
            --color-warning: #F59E0B;
            --color-warning-soft: rgba(245, 158, 11, 0.14);
          }
          :root[data-theme="gemini-light"] {
            --bg-canvas: #F1F7FD;
            --bg-surface: #FFFFFF;
            --bg-elevated: #E8F1FA;
            --bg-subtle-hover: #DCEAF6;
            --bg-glass: rgba(241, 247, 253, 0.94);
            --border-subtle: #D3E2F0;
            --border-divider: #E2ECF6;
            --text-primary: #0B1F33;
            --text-secondary: #3D5A73;
            --text-muted: #5E7488;
            --accent-primary: #0284C7;
            --accent-hover: #0369A1;
            --accent-soft: #E0F2FE;
            --accent-soft-border: #BAE6FD;
            --accent-glow: rgba(2, 132, 199, 0.09);
            --accent-halo: rgba(2, 132, 199, 0.15);
            --accent-ring: rgba(2, 132, 199, 0.24);
            --accent-shadow: rgba(2, 132, 199, 0.24);
            --accent-gradient-from: #38BDF8;
            --accent-secondary: #0369A1;
            --accent-gradient: linear-gradient(135deg, #38BDF8 0%, #0284C7 52%, #075985 100%);
            --boot-hairline: rgba(11, 31, 51, 0.12);
            --border-focus: #0284C7;
            --color-agent: #0369A1;
            --color-agent-soft: #E0F2FE;
            --color-success: #0F9E90;
            --color-success-soft: #F0FDFA;
            --color-warning: #D97706;
            --color-warning-soft: #FFFBEB;
          }
          :root[data-theme="gemini-dark"] {
            --bg-canvas: #07141F;
            --bg-surface: #0D2030;
            --bg-elevated: #153044;
            --bg-subtle-hover: #1B3B53;
            --bg-glass: rgba(7, 20, 31, 0.9);
            --border-subtle: #21445D;
            --border-divider: #19364B;
            --text-primary: #F0F9FF;
            --text-secondary: #A5C8DE;
            --text-muted: #6F93A8;
            --accent-primary: #0EA5E9;
            --accent-hover: #38BDF8;
            --accent-soft: rgba(14, 165, 233, 0.16);
            --accent-soft-border: rgba(14, 165, 233, 0.32);
            --accent-glow: rgba(14, 165, 233, 0.14);
            --accent-halo: rgba(14, 165, 233, 0.2);
            --accent-ring: rgba(14, 165, 233, 0.3);
            --accent-shadow: rgba(14, 165, 233, 0.3);
            --accent-gradient-from: #7DD3FC;
            --accent-secondary: #38BDF8;
            --accent-gradient: linear-gradient(135deg, #38BDF8 0%, #0EA5E9 52%, #0284C7 100%);
            --boot-hairline: rgba(240, 249, 255, 0.13);
            --border-focus: #0EA5E9;
            --color-agent: #38BDF8;
            --color-agent-soft: rgba(56, 189, 248, 0.16);
            --color-success: #14B8A6;
            --color-success-soft: rgba(20, 184, 166, 0.14);
            --color-warning: #F59E0B;
            --color-warning-soft: rgba(245, 158, 11, 0.14);
          }
          :root[data-theme="linear-light"] {
            --bg-canvas: #F7F4FB;
            --bg-surface: rgba(255, 255, 255, 0.88);
            --bg-elevated: #F0EAF8;
            --bg-subtle-hover: #E9E0F5;
            --bg-glass: rgba(255, 255, 255, 0.82);
            --border-subtle: #E2D6F3;
            --border-divider: #EDE5F7;
            --text-primary: #1E1035;
            --text-secondary: #53436B;
            --text-muted: #84749E;
            --accent-primary: #7C3AED;
            --accent-hover: #6D28D9;
            --accent-soft: #F3E8FF;
            --accent-soft-border: #E9D5FF;
            --accent-glow: rgba(139, 92, 246, 0.10);
            --accent-halo: rgba(139, 92, 246, 0.16);
            --accent-ring: rgba(124, 58, 237, 0.26);
            --accent-shadow: rgba(124, 58, 237, 0.28);
            --accent-gradient-from: #C026D3;
            --accent-secondary: #DB2777;
            --accent-gradient: linear-gradient(135deg, #7C3AED 0%, #C026D3 52%, #EA580C 100%);
            --boot-hairline: rgba(30, 16, 53, 0.12);
            --border-focus: #8B5CF6;
            --color-agent: #8B5CF6;
            --color-agent-soft: #F3E8FF;
            --color-success: #0F9E90;
            --color-success-soft: #F0FDFA;
            --color-warning: #D97706;
            --color-warning-soft: #FFFBEB;
          }
          :root[data-theme="linear-dark"] {
            --bg-canvas: #0D0914;
            --bg-surface: #161024;
            --bg-elevated: #221836;
            --bg-subtle-hover: #2A1D42;
            --bg-glass: rgba(13, 9, 20, 0.9);
            --border-subtle: #32244D;
            --border-divider: #271B3C;
            --text-primary: #FAF5FF;
            --text-secondary: #C4B5FD;
            --text-muted: #7E6E99;
            --accent-primary: #A855F7;
            --accent-hover: #C084FC;
            --accent-soft: rgba(168, 85, 247, 0.18);
            --accent-soft-border: rgba(168, 85, 247, 0.34);
            --accent-glow: rgba(168, 85, 247, 0.14);
            --accent-halo: rgba(168, 85, 247, 0.22);
            --accent-ring: rgba(168, 85, 247, 0.34);
            --accent-shadow: rgba(168, 85, 247, 0.36);
            --accent-gradient-from: #DB2777;
            --accent-secondary: #DB2777;
            --accent-gradient: linear-gradient(135deg, #9333EA 0%, #DB2777 55%, #F97316 100%);
            --boot-hairline: rgba(250, 245, 255, 0.12);
            --border-focus: #A855F7;
            --color-agent: #C4B5FD;
            --color-agent-soft: rgba(196, 181, 253, 0.16);
            --color-success: #14B8A6;
            --color-success-soft: rgba(20, 184, 166, 0.14);
            --color-warning: #F59E0B;
            --color-warning-soft: rgba(245, 158, 11, 0.14);
          }
          html, body, #root {
            width: 100%;
            min-height: 100%;
            margin: 0;
            padding: 0;
            background-color: var(--bg-canvas) !important;
          }
          html, body, #root { height: 100%; }
          html { scroll-behavior: smooth; }
          body { overflow-y: auto !important; }
          #root { display: flex; flex: 1; }
          body {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          ::selection { background: var(--accent-ring); color: var(--text-primary); }
          * { scrollbar-width: thin; scrollbar-color: rgba(142, 139, 130, 0.42) transparent; }
          *::-webkit-scrollbar { width: 8px; height: 8px; }
          *::-webkit-scrollbar-track { background: transparent; }
          *::-webkit-scrollbar-thumb { background: rgba(142, 139, 130, 0.34); border-radius: 999px; }
          *::-webkit-scrollbar-thumb:hover { background: rgba(142, 139, 130, 0.52); }
          [role="button"]:focus-visible, [role="radio"]:focus-visible, [role="tab"]:focus-visible, [role="switch"]:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
          #root input[aria-label="搜索资源"]:focus-visible {
            outline: 2px solid var(--border-focus);
            outline-offset: 2px;
            border-radius: 6px;
          }
          /* Login inputs: guarantee the focus ring with pure CSS on web. */
          #root div:has(> input[aria-label="用户名"]:focus),
          #root div:has(> input[aria-label="密码"]:focus) {
            border-color: var(--border-focus) !important;
            background-color: var(--bg-surface) !important;
            box-shadow: 0 0 0 3px var(--accent-ring), 0 0 22px var(--accent-glow) !important;
          }
          #root input[aria-label="用户名"]:focus,
          #root input[aria-label="密码"]:focus {
            outline: none !important;
          }

          /* ── Enterprise motion system ─────────────────────────────── */
          @keyframes auroraDriftA {
            0%   { transform: translate3d(0, 0, 0) scale(1); opacity: .82; }
            50%  { transform: translate3d(26px, -20px, 0) scale(1.08); opacity: 1; }
            100% { transform: translate3d(-18px, 16px, 0) scale(.97); opacity: .78; }
          }
          @keyframes auroraDriftB {
            0%   { transform: translate3d(0, 0, 0) scale(.98); opacity: .8; }
            50%  { transform: translate3d(-24px, 18px, 0) scale(1.07); opacity: 1; }
            100% { transform: translate3d(18px, -22px, 0) scale(1); opacity: .76; }
          }
          @keyframes gridScan {
            0%   { transform: translate3d(0, -40vh, 0); opacity: 0; }
            8%   { opacity: .7; }
            85%  { opacity: .35; }
            100% { transform: translate3d(0, 115vh, 0); opacity: 0; }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translate3d(0, 22px, 0) scale(.985); }
            to   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          }
          @keyframes shimmer {
            0%   { transform: translate3d(-160%, 0, 0) skewX(-14deg); }
            100% { transform: translate3d(280%, 0, 0) skewX(-14deg); }
          }
          @keyframes pulseRing {
            0%   { transform: scale(.72); opacity: .75; }
            100% { transform: scale(2.1); opacity: 0; }
          }
          @keyframes dataFlowBg {
            0%   { background-position: -45% 0; }
            100% { background-position: 145% 0; }
          }
          @keyframes agentBlink {
            0%, 100% { opacity: .14; transform: scale(.8); }
            50%      { opacity: 1; transform: scale(1.25); }
          }
          @keyframes sparkScan {
            0%   { transform: translate3d(-160%, 0, 0); opacity: 0; }
            15%  { opacity: 1; }
            85%  { opacity: 1; }
            100% { transform: translate3d(280%, 0, 0); opacity: 0; }
          }
          @keyframes energyPulse {
            0%, 100% { opacity: .55; transform: scaleY(.75); }
            50%      { opacity: 1; transform: scaleY(1); }
          }
          @keyframes caretBlink {
            0%, 49%   { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
          @keyframes badgeFloat {
            0%, 100% { transform: translate3d(0, 0, 0) rotate(-6deg); }
            50%      { transform: translate3d(0, -4px, 0) rotate(-3deg); }
          }
          @keyframes dotPulse {
            0%   { transform: scale(1); opacity: .45; }
            100% { transform: scale(2.1); opacity: 0; }
          }
          @keyframes meshBreath {
            0%, 100% { opacity: .32; transform: scale(.86); }
            50%      { opacity: 1; transform: scale(1.2); }
          }
          @keyframes fieldFlash {
            0%   { box-shadow: 0 0 0 0 var(--accent-ring); }
            38%  { box-shadow: 0 0 0 4px var(--accent-ring), 0 0 26px var(--accent-glow); }
            100% { box-shadow: 0 0 0 0 transparent; }
          }
          @keyframes starTwinkle {
            0%, 100% { opacity: .18; transform: scale(.8); }
            48%      { opacity: .95; transform: scale(1.15); }
            62%      { opacity: .5; transform: scale(.95); }
          }
          @keyframes panelIn {
            from { opacity: 0; transform: translate3d(0, 8px, 0); }
            to   { opacity: 1; transform: translate3d(0, 0, 0); }
          }
          /* ── Tutor streaming choreography ─────────────────────────── */
          @keyframes answerBubbleIn {
            from { opacity: 0; transform: translate3d(0, 10px, 0) scale(.992); }
            to   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          }
          @keyframes thinkingStepIn {
            from { opacity: 0; transform: translate3d(-4px, 6px, 0); }
            to   { opacity: 1; transform: translate3d(0, 0, 0); }
          }
          @keyframes moduleReveal {
            from { opacity: 0; transform: translate3d(0, 12px, 0); }
            to   { opacity: 1; transform: translate3d(0, 0, 0); }
          }
          @keyframes thinkingSpin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }

          /* ── Boot ritual ──────────────────────────────────────────── */
          @keyframes bootGlowBreath {
            0%, 100% { transform: scale(.95); opacity: .72; }
            50%      { transform: scale(1.08); opacity: 1; }
          }
          @keyframes bootOrbitSpin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          @keyframes bootOrbitSpinReverse {
            from { transform: rotate(0deg); }
            to   { transform: rotate(-360deg); }
          }
          @keyframes bootCorePulse {
            0%, 100% { transform: scale(.97); opacity: .94; }
            50%      { transform: scale(1.06); opacity: 1; }
          }
          @keyframes bootHalo {
            0%   { transform: scale(.86); opacity: .7; }
            100% { transform: scale(1.65); opacity: 0; }
          }
          @keyframes bootSweep {
            0%   { transform: translate3d(-140%, 0, 0); }
            100% { transform: translate3d(320%, 0, 0); }
          }
          @keyframes bootWake {
            0%, 66%, 100% { opacity: .32; transform: scale(.82); }
            12%, 40%      { opacity: 1; transform: scale(1.14); }
            52%           { opacity: .92; transform: scale(1); }
          }
          @keyframes bootDotBlink {
            0%, 100% { opacity: .35; }
            50%      { opacity: 1; }
          }
          @keyframes bootTextSheen {
            0%   { background-position: 130% 50%; }
            100% { background-position: -30% 50%; }
          }
          /* Squeeze telemetry labels on very narrow screens without a JS width branch. */
          @media (max-width: 389px) {
            #boot-agents div[dir="auto"] {
              font-size: 9.5px !important;
              letter-spacing: 0 !important;
              line-height: 12px !important;
            }
          }
          /* ── Apple-style scroll-driven reveal ─────────────────────── */
          .scroll-reveal {
            opacity: 0;
            transform: translate3d(0, 28px, 0) scale(0.98);
            transition:
              opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
            transition-delay: calc(var(--index, 0) * 60ms);
            will-change: transform, opacity;
          }
          .scroll-reveal.is-visible {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
          [data-reveal] {
            transition:
              opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
            will-change: transform, opacity;
          }
          [data-reveal="pending"] {
            opacity: 0;
            transform: translate3d(0, 28px, 0) scale(0.98);
          }
          [data-reveal="pending"][data-reveal-from="left"] {
            transform: translate3d(-28px, 16px, 0) scale(0.985);
          }
          [data-reveal="pending"][data-reveal-from="right"] {
            transform: translate3d(28px, 16px, 0) scale(0.985);
          }
          [data-reveal="visible"] {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
          @keyframes terminalLineIn {
            from { opacity: 0; transform: translate3d(0, 4px, 0); }
            to   { opacity: 1; transform: translate3d(0, 0, 0); }
          }

          @keyframes priorityBreath {
            0%, 100% { opacity: 0.82; transform: scale(1); }
            50%      { opacity: 1; transform: scale(1.035); }
          }
          /* Path workbench: vertical energy flow and horizontal DAG travel. */
          @keyframes timelineFlow {
            0%   { background-position: 0 -60%; opacity: 0; }
            16%  { opacity: 1; }
            84%  { opacity: 1; }
            100% { background-position: 0 160%; opacity: 0; }
          }
          @keyframes flowDot {
            0%   { transform: translate3d(0, 0, 0); opacity: 0; }
            18%  { opacity: 1; }
            82%  { opacity: 1; }
            100% { transform: translate3d(26px, 0, 0); opacity: 0; }
          }
          @keyframes boostGrow {
            from { transform: scaleX(0); opacity: 0; }
            to   { transform: scaleX(1); opacity: 0.7; }
          }
          @keyframes cardSheen {
            0%   { transform: translate3d(-170%, 0, 0); opacity: 0; }
            18%  { opacity: 0.55; }
            58%  { opacity: 0.18; }
            100% { transform: translate3d(250%, 0, 0); opacity: 0; }
          }
          [data-reveal="visible"] [data-sheen] {
            animation: cardSheen 1.15s cubic-bezier(0.16, 1, 0.3, 1) both;
            animation-delay: 120ms;
          }

          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
              animation-duration: 0.001ms !important;
              animation-delay: 0ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.001ms !important;
              scroll-behavior: auto !important;
            }
            .scroll-reveal,
            [data-reveal] {
              opacity: 1 !important;
              transform: none !important;
              transition: none !important;
              will-change: auto !important;
            }
          }

          /* React Navigation Web can render its default light canvas inline. */
          #root [style*="background-color:rgba(242,242,242"] {
            background-color: var(--bg-canvas) !important;
          }
        `}</style>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
