import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import './aviator.css'

function formatNumber(n, decimals = 2) {
    return Number(n).toFixed(decimals)
}

async function sha256Hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
    const bytes = Array.from(new Uint8Array(buf))
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('')
}

function mulberry32(a) {
    return function () {
        let t = a += 0x6D2B79F5
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

async function generateCrashFromSeeds(serverSeed, clientSeed, nonce) {
    // deterministically derive a random number from seeds using SHA-256 -> mulberry32
    const input = `${serverSeed}:${clientSeed}:${nonce}`
    const h = await sha256Hex(input)
    const seed = parseInt(h.slice(0, 8), 16) >>> 0
    const rng = mulberry32(seed || 1)
    const u = rng()
    // Pareto-style heavy tail: X = xm / u^(1/alpha) with xm=1
    const alpha = 1.35 // controls tail heaviness (lower -> heavier)
    const raw = 1 / Math.pow(u === 0 ? Number.MIN_VALUE : u, 1 / alpha)
    const capped = Math.min(1000, raw)
    return +capped.toFixed(2)
}

export default function Aviator() {
    const [multiplier, setMultiplier] = useState(1.0)
    const [status, setStatus] = useState('idle') // idle | running | crashed | cashed
    const [crashAt, setCrashAt] = useState(0)
    const [revealResult, setRevealResult] = useState(false)
    const [bet, setBet] = useState('1')
    const [activeBet, setActiveBet] = useState(null)
    const [balance, setBalance] = useState(100.00)
    const [history, setHistory] = useState([])
    const [serverSeed, setServerSeed] = useState('')
    const [serverSeedHash, setServerSeedHash] = useState('')
    const [clientSeed, setClientSeed] = useState('player')
    const [nonce, setNonce] = useState(0)
    const [copied, setCopied] = useState(false)
    const [confetti, setConfetti] = useState([])
    const [autoplay, setAutoplay] = useState(false)
    const [roundInterval, setRoundInterval] = useState(6) // seconds between rounds
    const [countdown, setCountdown] = useState(6)
    const [roundDurationMs, setRoundDurationMs] = useState(6000) // fixed duration for multiplier animation

    const rafRef = useRef(null)
    const startRef = useRef(0)
    const durationRef = useRef(4000)
    const progressRef = useRef(0)
    const timerRef = useRef(null)
    const audioRef = useRef(null)

    useEffect(() => {
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    }, [])

    useEffect(() => {
        if (serverSeed) {
            sha256Hex(serverSeed).then(h => setServerSeedHash(h))
        } else {
            setServerSeedHash('')
        }
    }, [serverSeed])

    function generateRandomSeed() {
        const arr = new Uint8Array(16)
        crypto.getRandomValues(arr)
        const s = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
        setServerSeed(s)
    }

    // --- Audio helper (simple tones) ---
    function ensureAudio() {
        try {
            if (!audioRef.current) {
                const C = window.AudioContext || window.webkitAudioContext
                audioRef.current = new C()
            }
            if (audioRef.current && audioRef.current.state === 'suspended') audioRef.current.resume()
        } catch (e) {/*ignore*/ }
    }

    function playSound(type) {
        try {
            ensureAudio()
            const ctx = audioRef.current
            if (!ctx) return
            const o = ctx.createOscillator()
            const g = ctx.createGain()
            o.connect(g); g.connect(ctx.destination)
            if (type === 'win') {
                o.frequency.value = 880
                g.gain.value = 0.02
                o.type = 'sine'
                o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
                o.stop(ctx.currentTime + 0.4)
            } else if (type === 'crash') {
                o.frequency.value = 140
                g.gain.value = 0.04
                o.type = 'sawtooth'
                o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7)
                o.stop(ctx.currentTime + 0.75)
            } else {
                o.frequency.value = 440; g.gain.value = 0.02; o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12); o.stop(ctx.currentTime + 0.14)
            }
        } catch (e) {/*ignore*/ }
    }

    // --- Confetti spawn ---
    function spawnConfetti({ count = 30, spread = 180 } = {}) {
        const cols = ['#ffd166', '#06b6d4', '#ff6b6b', '#a78bfa', '#34d399']
        const items = Array.from({ length: count }).map((_, i) => ({
            id: Date.now() + "-" + i,
            left: Math.random() * 100,
            y: -10,
            dur: 1000 + Math.random() * 900,
            color: cols[Math.floor(Math.random() * cols.length)]
        }))
        setConfetti(c => [...c, ...items])
        // clear after duration
        setTimeout(() => {
            setConfetti(c => c.slice(count))
        }, 1800)
    }

    // Autoplay / countdown effect
    useEffect(() => {
        if (autoplay) {
            if (status === 'idle') {
                setCountdown(roundInterval)
                if (timerRef.current) clearInterval(timerRef.current)
                timerRef.current = setInterval(() => {
                    setCountdown(c => {
                        if (c <= 1) {
                            clearInterval(timerRef.current);
                            timerRef.current = null;
                            setTimeout(() => startRound(), 120)
                            return roundInterval
                        }
                        return c - 1
                    })
                }, 1000)
            }
        } else {
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
            setCountdown(roundInterval)
        }
        return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoplay, status, roundInterval])

    async function startRound() {
        if (status === 'running') return
        // ensure seeds exist
        if (!serverSeed) generateRandomSeed()
        const crash = await generateCrashFromSeeds(serverSeed || '', clientSeed || '', nonce)
        setCrashAt(crash)
        setRevealResult(false)
        setStatus('running')
        setMultiplier(1.0)
        progressRef.current = 0

        // Physics: initial velocity and acceleration (units x per second)
        const v0 = 0.05 // initial velocity (0.05x per second)
        const a = 0.02  // acceleration (0.02x per second^2)
        // Solve 1 + v0*t + 0.5*a*t^2 = crash  for t (time to crash in seconds)
        let timeToCrashSec = 0.05
        if (crash > 1) {
            const disc = v0 * v0 - 2 * a * (1 - crash) // discriminant of quadratic
            if (disc <= 0) {
                timeToCrashSec = Math.max(0.05, (-v0 + Math.sqrt(Math.max(0, disc))) / a)
            } else {
                timeToCrashSec = Math.max(0.05, (-v0 + Math.sqrt(disc)) / a)
            }
        }
        // clamp to avoid absurdly long rounds
        const clampedTime = Math.max(0.05, Math.min(timeToCrashSec, 60000 / 1000))
        durationRef.current = clampedTime * 1000
        startRef.current = performance.now()

        function loop(now) {
            const elapsed = now - startRef.current
            const elapsedSec = elapsed / 1000
            // Kinematics: multiplier = 1 + v0 * t + 0.5 * a * t^2
            const v0 = 0.05
            const a = 0.02
            const value = 1 + v0 * elapsedSec + 0.5 * a * elapsedSec * elapsedSec
            // cap to crash
            const capped = Math.min(crash, value)
            setMultiplier(capped)
            // progress [0..1]
            progressRef.current = crash > 1 ? Math.min(1, (capped - 1) / (crash - 1)) : 1
            // update visual progress: end when capped reaches crash
            if (capped >= crash - 1e-12) {
                // crash
                setStatus('crashed')
                setRevealResult(true)
                setHistory(h => [{ type: 'crash', val: crash, seed: serverSeedHash, nonce }, ...h].slice(0, 12))
                // audio + visual
                try { playSound('crash') } catch (e) { }
                try { spawnConfetti({ count: 20, spread: 80 }) } catch (e) { }
                if (activeBet) {
                    // lost stake
                    setActiveBet(null)
                }
                setNonce(n => n + 1)
                return
            }
            rafRef.current = requestAnimationFrame(loop)
        }

        rafRef.current = requestAnimationFrame(loop)
    }

    function placeBet() {
        const amt = parseFloat(bet)
        if (isNaN(amt) || amt <= 0) return
        if (amt > balance) return alert('Insufficient balance')
        ensureAudio()
        setBalance(b => +(b - amt).toFixed(2))
        setActiveBet({ stake: amt, cashed: false })
    }

    function cashOut() {
        if (!activeBet || status !== 'running') return
        const payout = +(activeBet.stake * multiplier).toFixed(2)
        setBalance(b => +(b + payout).toFixed(2))
        setHistory(h => [{ type: 'win', val: formatNumber(multiplier), payout, seed: serverSeedHash, nonce }, ...h].slice(0, 12))
        setActiveBet(null)
        setStatus('cashed')
        setRevealResult(true)
        try { playSound('win') } catch (e) { }
        try { spawnConfetti({ count: 40, spread: 220 }) } catch (e) { }
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        setNonce(n => n + 1)
    }

    // Collect: allows immediate collection when running (cash out)
    // or refunds the stake before the round starts (idle).
    function collect() {
        if (!activeBet) return
        if (status === 'running') {
            // cash out during round
            cashOut()
            return
        }
        if (status === 'idle') {
            // refund stake before round start
            const refund = activeBet.stake
            setBalance(b => +(b + refund).toFixed(2))
            setHistory(h => [{ type: 'refund', val: 'refunded', payout: refund, nonce }, ...h].slice(0, 12))
            setActiveBet(null)
            try { playSound('win') } catch (e) { }
            try { spawnConfetti({ count: 12, spread: 60 }) } catch (e) { }
        }
    }

    function quickReset() {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        setMultiplier(1.0)
        setStatus('idle')
        setCrashAt(0)
    }

    const progressPercent = crashAt > 1 ? Math.min(99.9, (Math.log(Math.max(1, multiplier)) / Math.log(crashAt)) * 100) : 0

    return (
        <div className="aviator-root">
            <div className="aviator-top">
                <div className="aviator-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <div className="multiplier">{(function () {
                                // adaptive display precision so small-range rounds (e.g. 1.06x)
                                // show more decimals and feel like they're updating faster.
                                let decimals = 2
                                const c = crashAt || 0
                                if (status === 'running') {
                                    if (c > 0 && c < 1.2) decimals = 2
                                    else if (c > 0 && c < 1.5) decimals = 2
                                    else if (c > 0 && c < 3) decimals = 2
                                    else decimals = 2
                                } else {
                                    // after round ended, keep 2 decimals for tidy display
                                    decimals = 2
                                }
                                return formatNumber(multiplier, decimals)
                            })()}x</div>
                            <div className="multiplier-small">{status === 'crashed' ? (revealResult ? `Crashed @ ${crashAt}x` : 'Crashed') : status === 'cashed' ? (revealResult ? `Crashed @ ${crashAt}x` : 'You cashed out') : (status === 'running' ? 'Round active' : 'Idle')}</div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                            <div className="big-number">Balance</div>
                            <div style={{ fontSize: 22, fontWeight: 800 }}>${balance.toFixed(2)}</div>
                        </div>
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 12, color: '#9fb3d9' }}>Server seed hash:</div>
                        <div className="chip" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 420 }}>{serverSeedHash || '—'}</div>
                        <button className="copy-btn" onClick={async () => { if (serverSeedHash) { await navigator.clipboard.writeText(serverSeedHash); setCopied(true); setTimeout(() => setCopied(false), 1200) } }}>{copied ? 'Copied' : 'Copy Hash'}</button>
                        <button className="btn ghost" onClick={generateRandomSeed}>New Seed</button>
                        <input className="bet-input" style={{ width: 180 }} value={clientSeed} onChange={e => setClientSeed(e.target.value)} />
                        <div className="chip">Nonce: {nonce}</div>
                        <div style={{ marginLeft: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                            <label style={{ fontSize: 12, color: '#9fb3d9' }}>Auto</label>
                            <input type="checkbox" checked={autoplay} onChange={e => setAutoplay(e.target.checked)} />
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input className="bet-input" style={{ width: 80 }} value={roundInterval} onChange={e => setRoundInterval(Number(e.target.value) || 6)} />
                                <div className="countdown-badge">{autoplay && status === 'idle' ? `Next: ${countdown}s` : ''}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="run-area">
                <div className="aviator-card" style={{ flex: '0 0 320px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div className="controls">
                            <input className="bet-input" value={bet} onChange={e => setBet(e.target.value)} />
                            <button className="btn" onClick={placeBet}>Place Bet</button>
                            <button className="btn ghost" onClick={() => startRound()}>Start Round</button>
                            <button className="btn" onClick={collect} disabled={!activeBet || status === 'crashed'}>Collect</button>
                            <button className="btn" onClick={cashOut} disabled={!activeBet || status !== 'running'}>Cash Out</button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="chip">Active Bet: {activeBet ? `$${activeBet.stake}` : '—'}</div>
                            <div className={`chip ${status === 'crashed' ? 'crash-badge' : ''}`}>{status.toUpperCase()}</div>
                        </div>
                    </div>
                </div>

                <div style={{ flex: 1 }}>
                    <div className="aviator-card">
                        <div className="flight-track">
                            {/* Hide progress while running to avoid hinting crash point */}
                            <div className="progress-fill" style={{ width: revealResult ? `${progressPercent}%` : `0%` }} />
                            {status === 'running' && !revealResult ? (
                                <motion.div className="plane" animate={{ x: ["0%", "6%", "-4%", "0%"], y: [0, -6, 4, 0], rotate: [0, -6, 6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                                    ✈️
                                </motion.div>
                            ) : (
                                <motion.div className="plane" animate={{ x: `${progressPercent}%`, rotate: Math.min(12, progressPercent / 6 - 6) }} transition={{ type: 'spring', stiffness: 160, damping: 20 }}>
                                    ✈️
                                </motion.div>
                            )}
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="multiplier-small">Crash @ {revealResult ? (crashAt ? `${crashAt}x` : '—') : '—'}</div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button className="btn ghost" onClick={quickReset}>Reset</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="footer-row">
                <div className="aviator-card" style={{ flex: 1, marginRight: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div><strong>Recent:</strong></div>
                        <div className="history">
                            {history.map((h, i) => (
                                <div key={i} className="chip" title={h.type === 'win' ? `Won $${h.payout}` : `Crashed ${h.val}x`}>
                                    {h.type === 'win' ? <span className="win">W @ {h.val}x</span> : <span className="lose">{h.val}x</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="confetti-wrap" aria-hidden>
                        {confetti.map(c => (
                            <div key={c.id} className={`confetti animate`} style={{ left: `${c.left}%`, background: c.color, transform: `translateY(${c.y}px)`, animationDuration: `${c.dur}ms` }} />
                        ))}
                    </div>
                </div>

                <div style={{ flex: '0 0 220px' }} className="aviator-card">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontWeight: 800 }}>Game Info</div>
                        <div className="multiplier-small">Crash multiplier: <strong>{revealResult ? (crashAt || '—') : '—'}</strong></div>
                        <div className="multiplier-small">Round status: <strong>{status}</strong></div>
                        <div style={{ marginTop: 6, fontSize: 12, color: '#9fb3d9' }}>Provably-fair: server seed hash shown above</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
