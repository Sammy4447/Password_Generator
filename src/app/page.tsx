"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/* ─── Character Sets ─── */
const CHAR_SETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
};

type OptionKey = keyof typeof CHAR_SETS;

interface HistoryEntry {
  password: string;
  id: number;
}

/* ─── Strength Calculator ─── */
function calcStrength(password: string): {
  level: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 20) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { level: 1, label: "Weak", color: "var(--strength-weak)" };
  if (score <= 3) return { level: 2, label: "Fair", color: "var(--strength-fair)" };
  if (score <= 4) return { level: 3, label: "Good", color: "var(--strength-good)" };
  if (score <= 5) return { level: 4, label: "Strong", color: "var(--strength-strong)" };
  return { level: 5, label: "Excellent", color: "var(--strength-excellent)" };
}

/* ─── Entropy Calculator ─── */
function calcEntropy(length: number, options: Record<OptionKey, boolean>): number {
  let poolSize = 0;
  if (options.lowercase) poolSize += 26;
  if (options.uppercase) poolSize += 26;
  if (options.numbers) poolSize += 10;
  if (options.symbols) poolSize += CHAR_SETS.symbols.length;
  if (poolSize === 0) return 0;
  return Math.floor(length * Math.log2(poolSize));
}

/* ─── Time To Crack (simplified) ─── */
function timeToCrack(entropy: number): string {
  // Assume 10 billion guesses per second
  const seconds = Math.pow(2, entropy) / 1e10;
  if (seconds < 1) return "Instantly";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hrs`;
  if (seconds < 3.154e7) return `${Math.round(seconds / 86400)} days`;
  if (seconds < 3.154e9) return `${Math.round(seconds / 3.154e7)} yrs`;
  if (seconds < 3.154e12) return `${Math.round(seconds / 3.154e9)}K yrs`;
  if (seconds < 3.154e15) return `${Math.round(seconds / 3.154e12)}M yrs`;
  return "∞";
}

/* ─── SVG Icons ─── */
function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

/* ─── Colorized Password ─── */
function ColorizedPassword({ password }: { password: string }) {
  return (
    <>
      {password.split("").map((char, i) => {
        let className = "";
        if (/[A-Z]/.test(char)) className = "char-upper";
        else if (/[0-9]/.test(char)) className = "char-number";
        else if (/[^a-zA-Z0-9]/.test(char)) className = "char-symbol";
        return (
          <span key={i} className={className}>
            {char}
          </span>
        );
      })}
    </>
  );
}

/* ════════════════════════════════════════════════════ */
/*                  MAIN COMPONENT                     */
/* ════════════════════════════════════════════════════ */

export default function PasswordGenerator() {
  const [length, setLength] = useState(16);
  const [options, setOptions] = useState<Record<OptionKey, boolean>>({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: false,
  });
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyCopiedId, setHistoryCopiedId] = useState<number | null>(null);
  const idCounter = useRef(0);

  /* Generate password */
  const generatePassword = useCallback(() => {
    let charset = "";
    const activeKeys: OptionKey[] = [];
    (Object.keys(options) as OptionKey[]).forEach((key) => {
      if (options[key]) {
        charset += CHAR_SETS[key];
        activeKeys.push(key);
      }
    });
    if (charset.length === 0) {
      charset = CHAR_SETS.lowercase;
      activeKeys.push("lowercase");
    }

    // Ensure at least one char from each active set
    const required: string[] = [];
    activeKeys.forEach((key) => {
      const set = CHAR_SETS[key];
      const randomValues = new Uint32Array(1);
      crypto.getRandomValues(randomValues);
      required.push(set[randomValues[0] % set.length]);
    });

    // Fill rest with random chars
    const remaining = length - required.length;
    const randomValues = new Uint32Array(Math.max(0, remaining));
    crypto.getRandomValues(randomValues);

    const rest: string[] = [];
    for (let i = 0; i < remaining; i++) {
      rest.push(charset[randomValues[i] % charset.length]);
    }

    // Combine and shuffle
    const all = [...required, ...rest];
    for (let i = all.length - 1; i > 0; i--) {
      const shuffleValues = new Uint32Array(1);
      crypto.getRandomValues(shuffleValues);
      const j = shuffleValues[0] % (i + 1);
      [all[i], all[j]] = [all[j], all[i]];
    }

    const newPassword = all.join("");
    setPassword(newPassword);
    setCopied(false);

    // Add to history (max 5)
    setHistory((prev) => {
      const entry: HistoryEntry = { password: newPassword, id: ++idCounter.current };
      const next = [entry, ...prev];
      if (next.length > 5) next.pop();
      return next;
    });
  }, [length, options]);

  /* Generate on mount + when settings change */
  useEffect(() => {
    generatePassword();
  }, [generatePassword]);

  /* Copy to clipboard */
  const copyToClipboard = useCallback(async (text: string, isHistory?: number) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isHistory !== undefined) {
        setHistoryCopiedId(isHistory);
        setTimeout(() => setHistoryCopiedId(null), 1500);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      if (isHistory !== undefined) {
        setHistoryCopiedId(isHistory);
        setTimeout(() => setHistoryCopiedId(null), 1500);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    }
  }, []);

  /* Toggle option */
  const toggleOption = useCallback((key: OptionKey) => {
    setOptions((prev) => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      // Don't allow disabling last option
      if (prev[key] && activeCount <= 1) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  }, []);

  const strength = calcStrength(password);
  const entropy = calcEntropy(length, options);
  const crackTime = timeToCrack(entropy);

  const optionLabels: Record<OptionKey, string> = {
    uppercase: "A-Z",
    lowercase: "a-z",
    numbers: "0-9",
    symbols: "!@#$",
  };

  /* Slider background fill */
  const sliderFill = ((length - 4) / (64 - 4)) * 100;

  return (
    <main className="main-container">
      {/* Header */}
      <header className="header">
        <div className="header-icon" aria-hidden="true">🔐</div>
        <h1>PassForge</h1>
        <p>Generate cryptographically secure passwords</p>
      </header>

      {/* Card */}
      <section className="card" aria-label="Password generator controls">
        {/* Password Display */}
        <div className="password-display" id="password-display">
          <div className="password-text" aria-live="polite" aria-label="Generated password">
            <ColorizedPassword password={password} />
          </div>
          <div className="password-actions">
            <button
              className={`icon-btn ${copied ? "copied" : ""}`}
              onClick={() => copyToClipboard(password)}
              aria-label="Copy password"
              title="Copy"
              id="copy-btn"
            >
              {copied ? (
                <>
                  <CheckIcon />
                  <span className="copy-tooltip">Copied!</span>
                </>
              ) : (
                <CopyIcon />
              )}
            </button>
            <button
              className="icon-btn"
              onClick={generatePassword}
              aria-label="Regenerate password"
              title="Regenerate"
              id="regenerate-btn"
            >
              <RefreshIcon />
            </button>
          </div>
        </div>

        {/* Strength Meter */}
        <div className="strength-section" style={{ marginTop: 16 }}>
          <div className="strength-bars">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={`strength-bar ${level <= strength.level ? "active" : ""}`}
              >
                {level <= strength.level && (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: strength.color,
                      borderRadius: 2,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          <span className="strength-label" style={{ color: strength.color }}>
            {strength.label}
          </span>
        </div>

        <div className="section-divider" style={{ margin: "20px 0" }} />

        {/* Length Slider */}
        <div className="slider-section">
          <div className="slider-header">
            <span className="slider-label">Password Length</span>
            <span className="slider-value">{length}</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={4}
            max={64}
            value={length}
            onChange={(e) => setLength(parseInt(e.target.value))}
            aria-label="Password length"
            id="length-slider"
            style={{
              background: `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${sliderFill}%, rgba(255,255,255,0.08) ${sliderFill}%, rgba(255,255,255,0.08) 100%)`,
            }}
          />
        </div>

        <div className="section-divider" style={{ margin: "20px 0" }} />

        {/* Options */}
        <div className="options-grid">
          {(Object.keys(options) as OptionKey[]).map((key) => (
            <div
              key={key}
              className={`option-item ${options[key] ? "active" : ""}`}
              onClick={() => toggleOption(key)}
              role="checkbox"
              aria-checked={options[key]}
              tabIndex={0}
              id={`option-${key}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleOption(key);
                }
              }}
            >
              <div className="option-checkbox">✓</div>
              <span className="option-label">{optionLabels[key]}</span>
            </div>
          ))}
        </div>

        <div className="section-divider" style={{ margin: "20px 0" }} />

        {/* Generate Button */}
        <button className="generate-btn" onClick={generatePassword} id="generate-btn">
          <span className="btn-icon">⟳</span>
          Generate Password
        </button>
      </section>

      {/* Stats */}
      <div className="info-stats">
        <div className="stat-item">
          <span className="stat-value">{entropy}</span>
          <span className="stat-label">Bits Entropy</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{crackTime}</span>
          <span className="stat-label">Crack Time</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {Object.values(options).filter(Boolean).length}
          </span>
          <span className="stat-label">Char Sets</span>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <section className="history-section card" aria-label="Password history">
          <div className="history-header">
            <span className="history-title">🕘 Recent</span>
            <button
              className="history-clear"
              onClick={() => setHistory([])}
              id="clear-history-btn"
            >
              Clear
            </button>
          </div>
          <div className="history-list">
            {history.map((entry) => (
              <div key={entry.id} className="history-item">
                <span className="history-password">{entry.password}</span>
                <button
                  className={`history-copy-btn ${historyCopiedId === entry.id ? "copied" : ""}`}
                  onClick={() => copyToClipboard(entry.password, entry.id)}
                  aria-label="Copy password"
                  title="Copy"
                >
                  {historyCopiedId === entry.id ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="footer">
        All passwords are generated locally using the Web Crypto API. Nothing is
        stored or transmitted.
      </footer>
    </main>
  );
}
