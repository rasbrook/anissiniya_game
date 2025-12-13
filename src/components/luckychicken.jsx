import React, { useEffect, useRef, useState } from 'react'
import './luckychicken.css'
import chickenSprite from './assets/chicken_sprite.svg'
import carSprite from './assets/car_sprite.svg'

const defaultBase = 1
const LANE_HEIGHT = 68
const CROSS_MS = 1100

const Chicken = React.forwardRef(function Chicken({ state, style }, ref) {
    const crashed = state === 'lost'
    const cls = `chicken ${state === 'crossing' ? 'crossing' : ''} ${crashed ? 'crash' : ''}`
    return (
        <div ref={ref} className={cls} style={style} aria-hidden>
            <img src={chickenSprite} alt="chicken" />
        </div>
    )
})

function Car({ color = 'red', lane = 0, duration = 6, delay = 0, useFrontProbability = 0.25 }) {
    // a Car component that can occasionally pass in front of the chicken for tension
    const ref = useRef(null)
    const [z, setZ] = useState(25)
    useEffect(() => {
        const node = ref.current
        if (!node) return
        node.style.top = `${8 + lane * LANE_HEIGHT}px`
        node.style.animationDuration = `${duration}s`
        node.style.animationDelay = `${delay}s`

        let mounted = true
        // schedule random front-pass events repeating roughly every duration * 1000
        function schedule() {
            if (!mounted) return
            const when = 400 + Math.random() * (duration * 1000 - 200)
            const willFront = Math.random() < useFrontProbability
            if (willFront) {
                // raise z for a short time to appear in front
                setTimeout(() => { if (mounted) setZ(40) }, when)
                setTimeout(() => { if (mounted) setZ(25) }, when + 700)
            }
            // schedule next run
            setTimeout(schedule, duration * 1000 + 200)
        }
        const t = setTimeout(schedule, 200)
        return () => { mounted = false; clearTimeout(t) }
    }, [lane, duration, delay, useFrontProbability])

    const style = { zIndex: z }
    return (
        <div ref={ref} className={`car ${color}`} style={style} aria-hidden>
            <img src={carSprite} alt="car" style={{ width: '92px', height: '48px', display: 'block' }} className="lc-car-img" />
        </div>
    )
}

function Road({ children, lanes = 3, chickenLane = 0, nextMultiplier, roadRef, particleTriggerRef }) {
    // create some car lanes
    const colors = ['red', 'yellow', 'green']
    const cars = []
    for (let r = 0; r < lanes; r++) {
        const count = 2 + (r % 2)
        for (let i = 0; i < count; i++) {
            const duration = 4 + Math.random() * 4
            const delay = -(Math.random() * duration)
            cars.push(<Car key={`c-${r}-${i}`} color={colors[(i + r) % colors.length]} lane={r} duration={duration} delay={delay} />)
        }
    }
    // particle canvas setup
    const canvasRef = useRef(null)
    useEffect(() => {
        let ctx, w, h, raf, particles = []
        const canvas = canvasRef.current
        if (!canvas) return
        const resize = () => {
            w = canvas.width = canvas.clientWidth
            h = canvas.height = canvas.clientHeight
        }
        resize()
        ctx = canvas.getContext('2d')

        function spawn(type, x, y) {
            const arr = []
            if (type === 'win') {
                for (let i = 0; i < 24; i++) arr.push({ x, y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 1.8) * 4, life: 60 + Math.random() * 40, color: `hsl(${40 + Math.random() * 80},90%,60%)`, size: 2 + Math.random() * 3 })
            } else if (type === 'crash') {
                for (let i = 0; i < 18; i++) arr.push({ x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() * -3), life: 40 + Math.random() * 60, color: '#bfbfbf', size: 2 + Math.random() * 4, gravity: 0.28 })
            }
            particles.push(...arr)
        }

        function frame() {
            ctx.clearRect(0, 0, w, h)
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i]
                p.x += p.vx; p.y += p.vy
                if (p.gravity) p.vy += p.gravity
                p.life--
                ctx.globalAlpha = Math.max(0, p.life / 120)
                ctx.fillStyle = p.color
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
                if (p.life <= 0) particles.splice(i, 1)
            }
            raf = requestAnimationFrame(frame)
        }
        frame()
        // expose trigger
        if (particleTriggerRef) particleTriggerRef.current = (t, x, y) => spawn(t, x, y)
        // handle resize
        const obs = new ResizeObserver(resize); obs.observe(canvas)
        return () => { cancelAnimationFrame(raf); obs.disconnect(); particles = [] }
    }, [particleTriggerRef])

    return (
        <div ref={roadRef} className="road card" role="img" aria-label="road with lanes">
            <canvas className="particles-canvas" ref={canvasRef} />
            <div className="lanes">
                {Array.from({ length: lanes }).map((_, i) => (
                    <div className="lane" key={i}>
                        {i === chickenLane + 1 && nextMultiplier ? (<div className="next-badge">x{nextMultiplier.toFixed(2)}</div>) : null}
                    </div>
                ))}
            </div>
            {cars}
            {children}
        </div>
    )
}

function HUD({ baseBet, multiplier, winnings, safeChance, nextMultiplier, balance }) {
    return (
        <div className="hud">
            <div className="stat"><div className="label">Balance</div><div className="value">${(balance || 0).toFixed(2)}</div></div>
            <div className="stat"><div className="label">Base Bet</div><div className="value">${baseBet.toFixed(2)}</div></div>
            <div className="stat"><div className="label">Multiplier</div><div className="value">x{multiplier.toFixed(2)}</div></div>
            <div className="stat"><div className="label">Potential Winnings</div><div className="value">${winnings.toFixed(2)}</div></div>
            <div className="stat"><div className="label">Safe Chance</div><div className="value">{Math.round(safeChance * 100)}%</div></div>
            <div className="stat"><div className="label">Next Avg Mult.</div><div className="value">x{nextMultiplier.toFixed(2)}</div></div>
        </div>
    )
}

export default function LuckyChicken() {
    const [baseBet, setBaseBet] = useState(defaultBase)
    const [multiplier, setMultiplier] = useState(1)
    const [winnings, setWinnings] = useState(0)
    const [status, setStatus] = useState('idle') // idle, crossing, won, lost, cashed
    const [log, setLog] = useState([])
    const [safeChance, setSafeChance] = useState(0.72)
    const [seed, setSeed] = useState(0)
    const chickenKey = useRef(0)
    const audioRef = useRef(null)
    const chickenRef = useRef(null)
    const [chickenLane, setChickenLane] = useState(0)
    const LANES = 3
    const [chickenTransform, setChickenTransform] = useState(`translateX(0) translateY(${0 * LANE_HEIGHT}px)`)
    const roadRef = useRef(null)
    const particleTriggerRef = useRef(null)
    // balance persisted
    const BAL_KEY = 'lc-balance-v1'
    const [balance, setBalance] = useState(() => {
        try { const s = localStorage.getItem(BAL_KEY); return s ? Number(s) : 100 }
        catch (e) { return 100 }
    })
    const [betPlaced, setBetPlaced] = useState(false)

    function ensureAudio() {
        if (!audioRef.current) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext
            try {
                audioRef.current = new AudioCtx()
            } catch (e) {
                audioRef.current = null
            }
        }
        return audioRef.current
    }

    function playCluck() {
        const ac = ensureAudio()
        if (!ac) return
        try { ac.resume && ac.resume() } catch (e) { }
        const o = ac.createOscillator()
        const g = ac.createGain()
        o.type = 'sine'
        o.frequency.setValueAtTime(900, ac.currentTime)
        g.gain.setValueAtTime(0.0001, ac.currentTime)
        g.gain.exponentialRampToValueAtTime(0.06, ac.currentTime + 0.02)
        o.connect(g); g.connect(ac.destination)
        o.start()
        o.frequency.exponentialRampToValueAtTime(420, ac.currentTime + 0.14)
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.5)
        o.stop(ac.currentTime + 0.52)
    }

    function playWin() {
        const ac = ensureAudio()
        if (!ac) return
        try { ac.resume && ac.resume() } catch (e) { }
        const o1 = ac.createOscillator(); const o2 = ac.createOscillator(); const g = ac.createGain()
        o1.type = 'sine'; o2.type = 'triangle'
        o1.frequency.setValueAtTime(600, ac.currentTime); o2.frequency.setValueAtTime(900, ac.currentTime)
        g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.08, ac.currentTime + 0.01)
        o1.connect(g); o2.connect(g); g.connect(ac.destination)
        o1.start(); o2.start()
        o1.frequency.exponentialRampToValueAtTime(780, ac.currentTime + 0.32)
        o2.frequency.exponentialRampToValueAtTime(1050, ac.currentTime + 0.32)
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.8)
        o1.stop(ac.currentTime + 0.9); o2.stop(ac.currentTime + 0.9)
    }

    function playCrash() {
        const ac = ensureAudio()
        if (!ac) return
        try { ac.resume && ac.resume() } catch (e) { }
        const bufferSize = ac.sampleRate * 0.4
        const b = ac.createBuffer(1, bufferSize, ac.sampleRate)
        const data = b.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) { data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) }
        const src = ac.createBufferSource(); src.buffer = b
        const g = ac.createGain(); g.gain.setValueAtTime(0.6, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35)
        src.connect(g); g.connect(ac.destination); src.start()
    }

    useEffect(() => {
        setWinnings(baseBet * multiplier)
    }, [baseBet, multiplier])

    function pushLog(text) {
        setLog(l => [text, ...l].slice(0, 200))
    }

    function reset() {
        setMultiplier(1)
        setStatus('idle')
        setWinnings(baseBet)
        setChickenLane(0)
        setChickenTransform(`translateX(0) translateY(${0 * LANE_HEIGHT}px)`)
        const node = chickenRef.current
        if (node) node.classList.remove('crash')
        pushLog('Game reset. Ready.')
    }

    function cashOut() {
        if (!betPlaced) { pushLog('No active bet to cash out'); return }
        const amount = +(baseBet * multiplier).toFixed(2)
        setWinnings(amount)
        setStatus('cashed')
        playWin()
        // credit full payout to balance
        setBalance(b => { const nb = +(b + amount).toFixed(2); try { localStorage.setItem(BAL_KEY, nb) } catch (e) { }; return nb })
        setBetPlaced(false)
        pushLog(`Cashed out $${amount.toFixed(2)} (x${multiplier.toFixed(2)})`)
    }

    function continueCross() {
        if (status === 'crossing') return
        if (chickenLane >= LANES) { pushLog('Chicken already in safe area'); return }

        const targetLane = chickenLane + 1
        const targetTransform = `translateX(calc(100% + 100px)) translateY(${targetLane * LANE_HEIGHT}px)`
        // check and place bet once when starting the crossing sequence
        if (!betPlaced) {
            if (balance < baseBet) { pushLog('Insufficient balance to place bet'); return }
            setBalance(b => { const nb = +(b - baseBet).toFixed(2); try { localStorage.setItem(BAL_KEY, nb) } catch (e) { }; return nb })
            setBetPlaced(true)
            pushLog(`Placed bet $${baseBet.toFixed(2)} (balance: $${(balance - baseBet).toFixed(2)})`)
        }
        // start crossing animation (transform changes)
        setStatus('crossing')
        chickenKey.current += 1
        setChickenTransform(targetTransform)
        pushLog('Chicken starts crossing...')
        playCluck()

        // after visual crossing, decide success
        setTimeout(() => {
            const r = Math.random()
            const success = r <= safeChance
            if (success) {
                // finalize landing in next lane without jump
                const node = chickenRef.current
                if (node) {
                    // temporarily disable transition, snap to new base translate (no X offset)
                    const prevTrans = node.style.transition
                    node.style.transition = 'none'
                    setChickenTransform(`translateX(0) translateY(${targetLane * LANE_HEIGHT}px)`)
                    // force reflow
                    void node.offsetHeight
                    node.style.transition = prevTrans || 'transform 1100ms cubic-bezier(.2,.9,.2,1)'
                } else {
                    setChickenTransform(`translateX(0) translateY(${targetLane * LANE_HEIGHT}px)`)
                }

                // increase multiplier
                const factor = 1 + 0.12 + Math.random() * 0.68
                setMultiplier(prev => +(prev * factor).toFixed(2))
                setChickenLane(targetLane)
                const node2 = chickenRef.current
                if (node2) node2.classList.remove('crash')
                setStatus('won')
                playWin()
                // spawn win particles at chicken pos
                try {
                    const r = roadRef.current.getBoundingClientRect()
                    const c = chickenRef.current.getBoundingClientRect()
                    const x = (c.left - r.left) + c.width / 2
                    const y = (c.top - r.top) + c.height / 2
                    particleTriggerRef.current && particleTriggerRef.current('win', x, y)
                } catch (e) { }
                pushLog(`Safe! Multiplier x${(multiplier * factor).toFixed(2)}`)
            } else {
                // leave chicken at collision point and play crash
                setStatus('lost')
                setMultiplier(0)
                setWinnings(0)
                // keep transform as-is (collision position), add crash class via DOM
                const node = chickenRef.current
                if (node) node.classList.add('crash')
                playCrash()
                try {
                    const r = roadRef.current.getBoundingClientRect()
                    const c = chickenRef.current.getBoundingClientRect()
                    const x = (c.left - r.left) + c.width / 2
                    const y = (c.top - r.top) + c.height / 2
                    particleTriggerRef.current && particleTriggerRef.current('crash', x, y)
                } catch (e) { }
                pushLog('Oh no — the chicken got hit! You lost the bet.')
            }
        }, CROSS_MS)
    }

    const nextMultiplierEstimate = multiplier * (1 + 0.12 + 0.68 * 0.5)

    return (
        <div className="lc-wrap" role="application" aria-label="Lucky Chicken gambling game">
            <div className="lc-left">
                <div className="title">Lucky Chicken — Cross That Road!</div>
                <Road lanes={LANES} chickenLane={chickenLane} nextMultiplier={nextMultiplierEstimate} roadRef={roadRef} particleTriggerRef={particleTriggerRef}>
                    <Chicken ref={chickenRef} state={status} style={{ transform: chickenTransform }} />
                </Road>
                <div className="card" style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>Game Log</div>
                        <div style={{ color: '#94a3b8', fontSize: 13 }}>{status.toUpperCase()}</div>
                    </div>
                    <div className="log" aria-live="polite">
                        {log.length === 0 ? <div style={{ color: '#64748b' }}>No actions yet — press Continue to play.</div> : log.map((l, i) => (<div key={i}>• {l}</div>))}
                    </div>
                </div>
            </div>
            <div className="lc-right">
                <div className="card">
                    <div className="title">HUD</div>
                    <div style={{ marginTop: 8 }}>
                        <HUD baseBet={baseBet} multiplier={multiplier || 0} winnings={+(baseBet * multiplier || 0)} safeChance={safeChance} nextMultiplier={nextMultiplierEstimate} balance={balance} />
                    </div>
                </div>

                <div className="card">
                    <div className="title">Controls</div>
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ fontSize: 13, color: '#94a3b8' }}>Base Bet</label>
                        <input aria-label="base bet" type="number" min="0.1" step="0.1" value={baseBet} onChange={e => setBaseBet(Math.max(0.1, Number(e.target.value) || 0.1))} style={{ padding: 8, borderRadius: 8, border: 'none', background: '#0b1220', color: '#fff' }} />
                        <div className="controls">
                            <button className="btn continue" onClick={continueCross} disabled={status === 'lost' || status === 'cashed' || status === 'crossing'} aria-disabled={status === 'crossing'}>Continue</button>
                            <button className="btn cashout" onClick={cashOut} disabled={status === 'idle' || status === 'lost' || status === 'cashed'}>Cash Out</button>
                        </div>
                        <div className="center-row">
                            <div style={{ flex: 1 }}>
                                <div className="stat"><div className="label">Winnings</div><div className="value">${(baseBet * multiplier).toFixed(2)}</div></div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn" onClick={reset}>Reset</button>
                            <button className="btn" onClick={() => { setSafeChance(s => Math.min(0.98, +(s + 0.03).toFixed(2))); pushLog('Increased safe chance') }}>Safer</button>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="title">Accessibility & Info</div>
                    <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>Colors and sizes tuned for readability. Buttons have clear states and keyboard focus. Screen readers will get HUD updates via aria-live where applicable.</div>
                </div>
            </div>
        </div>
    )
}
