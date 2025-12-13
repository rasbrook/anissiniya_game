import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import { SupabaseHost } from "../../supabase";

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

const randomSample = (n, k) => {
    const out = new Set();
    while (out.size < k) out.add(Math.floor(Math.random() * n) + 1);
    return Array.from(out);
};

// combination as floating number computed multiplicatively to avoid huge
// intermediate factorials: C(n,k) = product_{i=1..k} (n-k+i)/i
const comb = (n, k) => {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let res = 1;
    for (let i = 1; i <= k; i++) {
        res *= (n - k + i) / i;
    }
    return res;
};

// exact combination using BigInt
const combBig = (n, k) => {
    if (k < 0 || k > n) return 0n;
    k = Math.min(k, n - k);
    let res = 1n;
    for (let i = 1; i <= k; i++) {
        res = res * BigInt(n - k + i) / BigInt(i);
    }
    return res;
};

// divide two BigInts and return decimal string with `decimals` fractional digits
const bigDivToFixed = (numer, denom, decimals) => {
    if (denom === 0n) return '0';
    const neg = (numer < 0n) !== (denom < 0n);
    if (numer < 0n) numer = -numer;
    if (denom < 0n) denom = -denom;
    const intPart = numer / denom;
    let rem = numer % denom;
    let frac = '';
    for (let i = 0; i < decimals; i++) {
        rem *= 10n;
        const digit = rem / denom;
        frac += digit.toString();
        rem = rem % denom;
    }
    // round last digit
    // perform basic rounding by checking next digit
    rem *= 10n;
    const next = rem / denom;
    if (next >= 5n) {
        // round up
        let carry = 1;
        let arr = frac.split('').map(d => parseInt(d, 10));
        for (let i = arr.length - 1; i >= 0 && carry; i--) {
            const val = arr[i] + carry;
            arr[i] = val % 10;
            carry = Math.floor(val / 10);
        }
        if (carry) {
            // increment intPart
            const newInt = (BigInt(intPart) + 1n).toString();
            return (neg ? '-' : '') + newInt + '.' + arr.join('');
        }
        frac = arr.join('');
    }
    return (neg ? '-' : '') + intPart.toString() + (decimals > 0 ? '.' + frac : '');
};

// hypergeometric probability: for a ticket with `spots` picks, probability of exactly k hits
// when 20 numbers are drawn from 1..80
const hyperProb = (spots, k) => {
    if (k < 0 || k > spots || k > 20) return 0;
    const numerator = comb(spots, k) * comb(80 - spots, 20 - k);
    const denom = comb(80, 20);
    return numerator / denom;
};

const formatPct = (v) => (v * 100).toFixed(3) + '%';

export default function KenoDisplay({ maxPicks = 10, drawCount = 20 }) {
    const numbers = range(80);
    const [players, setPlayers] = useState([
        { id: 1, name: 'Player 1', bet: 20, picks: [] }
    ]);
    const [gameId, setGameId] = useState(() => + Date.now() + '-' + Math.random().toString(20).substr(2, 9).toUpperCase());


    const [spotLimit, setSpotLimit] = useState(maxPicks);
    const [editingMap, setEditingMap] = useState(() => ({ 1: true }));
    const [activePlayerId, setActivePlayerId] = useState(1);
    const [drawn, setDrawn] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const drawTimer = useRef(null);
    const [recentDraw, setRecentDraw] = useState(null);
    const [results, setResults] = useState([]);
    const { userId } = useAuthStore();
    const [balance, setBalance] = useState(0);
    const [activeSwitch, setActiveSwitch] = useState(false);
    const [tailBoost, setTailBoost] = useState(0.5); // 0 = no change, up to 4 for strong tail boost



    const togglePick = (num) => {
        if (showResults) return;
        setPlayers(prev => prev.map(pl => {
            // toggle only for players currently marked for editing
            if (!editingMap[pl.id]) return pl;
            const has = pl.picks.includes(num);
            if (has) return { ...pl, picks: pl.picks.filter(x => x !== num) };
            if (pl.picks.length >= spotLimit) return pl;
            return { ...pl, picks: [...pl.picks, num] };
        }));
    };



    const activatePlayer = (id, { clearPicks = false } = {}) => {
        setPlayers(prev => prev.map(pl => pl.id === id ? { ...pl, picks: clearPicks ? [] : pl.picks } : pl));
        setActivePlayerId(id);
        // set only this player as editable
        setEditingMap({ [id]: true });
        // brief board pulse animation
        setActiveSwitch(true);
        setTimeout(() => setActiveSwitch(false), 420);
    };

    useEffect(() => {
        const fetchBalance = async () => {
            if (userId) {
                const { data, error } = await SupabaseHost
                    .from('host')
                    .select('balance')
                    .eq('id', userId)
                    .single();
                if (data) {
                    setBalance(data.balance);
                }
            }
        };
        fetchBalance();
    }, [userId]);

    const quickPick = (forPlayerId = activePlayerId) => {
        if (showResults) return;
        const q = randomSample(80, Math.min(spotLimit, 80));
        setPlayers(prev => prev.map(pl => pl.id === forPlayerId ? { ...pl, picks: q } : pl));
    };

    // add a new player and make them active/editable
    const addPlayer = () => {
        // compute nextId and append player; then activate the new player so they're editable
        let nextId = 1;
        setPlayers(prev => {
            nextId = prev.length ? Math.max(...prev.map(p => p.id)) + 1 : 1;
            const newPlayer = { id: nextId, name: `Player ${nextId}`, bet: 20, picks: [] };
            return [...prev, newPlayer];
        });
        // use activatePlayer to ensure editingMap and active state are set consistently
        // call it after setPlayers so nextId has been computed above
        activatePlayer(nextId, { clearPicks: false });
    };

    // remove a player by id; update editing map, active player and results
    const removePlayer = (id) => {
        setPlayers(prev => {
            const next = prev.filter(p => p.id !== id);
            // if the removed player was active, pick a new active player (first remaining) or null
            if (activePlayerId === id) {
                setActivePlayerId(next.length ? next[0].id : null);
            }
            return next;
        });
        setEditingMap(m => {
            const copy = { ...m };
            delete copy[id];
            return copy;
        });
        setResults(prev => prev.filter(r => r.id !== id));
    };

    const basePayoutTable = {
        // simplified multipliers (bet * multiplier)
        // keys are number of spots (picks)
        1: { 1: 2 },
        2: { 2: 12, 1: 1 },
        3: { 3: 48, 2: 3, 1: 0 },
        4: { 4: 240, 3: 12, 2: 1, 1: 0 },
        5: { 5: 1200, 4: 50, 3: 6, 2: 1 },
        6: { 6: 3000, 5: 300, 4: 25, 3: 3, 2: 1 },
        7: { 7: 5000, 6: 1500, 5: 120, 4: 10, 3: 2 },
        8: { 8: 10000, 7: 3000, 6: 500, 5: 50, 4: 6, 3: 1 },
        9: { 9: 20000, 8: 5000, 7: 1000, 6: 200, 5: 30, 4: 4 },
        10: { 10: 50000, 9: 10000, 8: 2000, 7: 400, 6: 60, 5: 8 }
    };



    // target house edge percent (house keeps this fraction of bets in the long run)
    const targetHouseEdgePercent = 20; // 20% house edge
    const computeScaledPayouts = (spots, houseEdgeNum = 20, houseEdgeDen = 100) => {
        const houseEdge = houseEdgeNum / houseEdgeDen; // 0.20 for 20%
        const table = basePayoutTable[spots] || {};
        const maxK = spots;



        // build a 'boosted' base multiplier shape to make small wins more common (playability)
        const boosted = [];
        for (let k = 0; k <= maxK; k++) {
            const base = table[k] !== undefined ? table[k] : (k >= 1 ? 1 : 0);
            let boostFactor = 1;
            if (k === 1) boostFactor = 1.5;
            else if (k === 2) boostFactor = 1.3;
            else if (k > 2 && k < maxK) boostFactor = 1.15;
            else if (k === maxK) boostFactor = 1;
            boosted[k] = base * boostFactor;
        }

        // compute probabilities (floating) and expected base payout
        let expectedBase = 0;
        const probs = [];
        for (let k = 0; k <= maxK; k++) {
            const p = hyperProb(spots, k);
            probs[k] = p;
            expectedBase += p * (boosted[k] || 0);
        }
        if (!(expectedBase > 0)) return null;

        // scale so that expected multiplier = 1 - houseEdge
        const targetExpected = 1 - houseEdge;
        const scale = targetExpected / expectedBase;

        const newTable = {};
        for (let k = 0; k <= maxK; k++) {
            const val = (boosted[k] || 0) * scale;
            // keep higher precision, UI will format as needed
            newTable[k] = +val.toFixed(6);
        }
        return newTable;
    };


    // build the active payout table by scaling the base table to target house edge
    const payoutTable = (() => {
        const out = {};
        for (let s = 1; s <= maxPicks; s++) {
            const scaled = computeScaledPayouts(s, targetHouseEdgePercent, 100);
            out[s] = scaled || {};
        }
        return out;
    })();



    // quick verification: compute expected multiplier per spot and log to console
    useEffect(() => {
        try {
            for (let s = 1; s <= maxPicks; s++) {
                const table = payoutTable[s] || {};
                let expected = 0;
                for (let k = 0; k <= s; k++) {
                    const p = hyperProb(s, k);
                    expected += p * (table[k] || 0);
                }
                // log expected multiplier (should be close to 1 - targetHouseEdgePercent/100)
                // using console (developer) so you can inspect in browser devtools
            }
        } catch (e) { /* ignore */ }
    }, []);



    // Compute scaled payout multipliers for a spot size to target a house edge.
    // Use floating arithmetic to avoid integer-scaling mistakes. Returns multipliers m_k
    // such that sum_k P(k) * m_k = 1 - houseEdge (e.g. 0.8 for 20% house edge).


    const computePayout = (player, drawnSet) => {
        const hits = player.picks.filter(p => drawnSet.includes(p)).length;
        const spots = player.picks.length;
        // derive a (possibly) tail-boosted table to make big wins rarer but larger
        const tableBase = payoutTable[spots] || {};
        const table = applyTailBoostToTable(spots, tailBoost, 3, tableBase);
        // Use explicit table value when present; otherwise treat as 0 (no payout).
        const multiplier = (table && Object.prototype.hasOwnProperty.call(table, hits)) ? table[hits] : 0;
        return { hits, multiplier, payout: +(player.bet * multiplier).toFixed(2) };
    };



    // Create a tail-heavy version of a payout table by redistributing weight toward larger k.
    // - spots: number of picks
    // - boost: 0..n, where 0 means no change, larger makes top-end larger
    // - power: exponent shaping how sharply weight rises with k
    // - baseTable: optional explicit base multipliers (if omitted, uses `payoutTable`)
    const applyTailBoostToTable = (spots, boost = 0.5, power = 3, baseTable = null) => {
        const orig = baseTable || (payoutTable[spots] || {});
        // probabilities for k=0..spots
        const probs = [];
        for (let k = 0; k <= spots; k++) probs.push(hyperProb(spots, k));
        // original expected multiplier
        const expectedOrig = probs.reduce((acc, p, k) => acc + p * (orig[k] || 0), 0);
        if (expectedOrig === 0) return orig; // nothing to scale against

        // build adjusted weights
        const wprime = [];
        for (let k = 0; k <= spots; k++) {
            const base = (orig && Object.prototype.hasOwnProperty.call(orig, k)) ? orig[k] : (k >= 1 ? 1 : 0);
            const frac = (spots > 0) ? (k / spots) : 0;
            const factor = 1 + boost * Math.pow(frac, power);
            wprime[k] = base * factor;
        }

        // compute scaling s so that expected multiplier stays equal to expectedOrig
        let denom = 0;
        for (let k = 0; k <= spots; k++) denom += probs[k] * wprime[k];
        if (denom === 0) return orig;
        const s = expectedOrig / denom;

        const out = {};
        for (let k = 0; k <= spots; k++) {
            const val = +(s * wprime[k]).toFixed(2);
            out[k] = val;
        }
        return out;
    };



    const draw = () => {
        if (drawTimer.current) return; // already drawing
        setDrawn([]);
        setRecentDraw(null);
        setShowResults(false);
        setResults([]);

        const order = randomSample(80, Math.min(drawCount, 80));
        let idx = 0;
        const progressive = [];
        drawTimer.current = setInterval(() => {
            progressive.push(order[idx]);
            setDrawn([...progressive]);
            setRecentDraw(order[idx]);
            idx += 1;
            if (idx >= order.length) {
                clearInterval(drawTimer.current);
                drawTimer.current = null;
                setShowResults(true);
                // compute results
                const final = players.map(pl => ({
                    id: pl.id,
                    name: pl.name,
                    bet: pl.bet,
                    picks: pl.picks,
                    ...computePayout(pl, order)
                }));
                setResults(final);
            }
        }, 280);
    };

    const reset = () => {
        setPlayers(prev => prev.map(pl => ({ ...pl, picks: [] })));
        setDrawn([]);
        setShowResults(false);
        setResults([]);
        setRecentDraw(null);
        setGameId('GAME-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase());
        if (drawTimer.current) { clearInterval(drawTimer.current); drawTimer.current = null; }
    };

    const hits = [];

    useEffect(() => {
        return () => { if (drawTimer.current) clearInterval(drawTimer.current); };
    }, []);

    return (
        <div style={{
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            fontFamily: 'Segoe UI, Roboto, system-ui, sans-serif',
            marginTop: 50
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h2 style={{ margin: 0 }}>Keno</h2>
                <div style={{
                    marginLeft: 12,
                    fontSize: 12,
                    color: 'var(--muted)',
                    background: 'var(--surface)',
                    padding: '6px 10px',
                    borderRadius: 8,
                    boxShadow: '0 6px 18px var(--card-shadow)'
                }}>
                    Players: <strong style={{ color: 'var(--active)' }}>{players.length}</strong> | Game ID: <strong>{gameId}</strong>
                </div>
            </div>

            {/* spot/difficulty selector and probability table for selected spot size */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Spots:</div>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(s => (
                        <button key={s} onClick={() => {
                            setSpotLimit(s);
                            // trim players picks if they exceed new limit
                            setPlayers(prev => prev.map(pl => ({ ...pl, picks: pl.picks.slice(0, s) })));
                        }} style={{ ...btnStyle, padding: '6px 8px', background: spotLimit === s ? 'var(--active)' : 'var(--primary)' }}>{s}</button>
                    ))}
                </div>

                <div style={{ marginLeft: 12, background: 'var(--muted-surface)', padding: 10, borderRadius: 8, boxShadow: '0 8px 20px var(--card-shadow)' }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Exact probabilities ({spotLimit}-spot)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                        {Array.from({ length: spotLimit + 1 }, (_, k) => k).map(k => {
                            const p = hyperProb(spotLimit, k);
                            return (
                                <div key={k} style={{ fontSize: 12, padding: 6, background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--card-border)' }}>
                                    <div style={{ fontWeight: 700 }}>{k} hits</div>
                                    <div style={{ fontFamily: 'monospace' }}>{p.toFixed(10)}</div>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                        Sum: <strong style={{ fontFamily: 'monospace' }}>{Array.from({ length: spotLimit + 1 }, (_, k) => hyperProb(spotLimit, k)).reduce((a, b) => a + b, 0).toFixed(12)}</strong>
                    </div>
                </div>
            </div>

            {/* controls */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => quickPick()} style={btnStyle} disabled={showResults}>Quick Pick (active)</button>
                    <button onClick={draw} style={{ ...btnStyle, background: balance <= 0 ? 'var(--muted)' : 'var(--danger)', color: 'var(--surface)', opacity: balance <= 0 ? 0.5 : 1 }} disabled={balance <= 0}>{balance <= 0 ? 'Insufficient Balance' : `Draw ${drawCount}`}</button>
                    {balance <= 0 && (
                        <p style={{
                            color: 'var(--accent)',
                            fontSize: 14,
                            marginLeft: 8,
                            marginBottom: 0
                        }}>
                            Please recharge to play
                        </p>
                    )}
                    <button onClick={reset} style={{ ...btnStyle, background: 'var(--muted)', color: 'var(--surface)' }}>Reset</button>
                    <button onClick={addPlayer} style={{ ...btnStyle, background: 'var(--accent)' }}>Add Player</button>
                </div>

                <div style={{ marginLeft: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => {
                        const printWindow = window.open('', '_blank');
                        const printableContent = `
                            <html>
                            <head>
                                <title>Keno Player Cards</title>
                                <style>
                                    body { font-family: Arial, sans-serif; margin: 20px; }
                                    .card { border: 1px solid #ccc; padding: 10px; margin-bottom: 20px; page-break-inside: avoid; }
                                    .card h3 { margin-top: 0; }
                                    .numbers { display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; }
                                    .number { padding: 5px; text-align: center; border: 1px solid #000; }
                                    .picked { background-color: #8CE4FF; }
                                </style>
                            </head>
                            <body>
                                <h1>Keno Player Cards</h1>
                                ${players.map(pl => `
                                    <div class="card">
                                        <h3>${pl.name} - Bet: ${pl.bet} Birr</h3>
                                        <div class="numbers">
                                            ${range(80).map(n => `<div class="number ${pl.picks.includes(n) ? 'picked' : ''}">${n}</div>`).join('')}
                                        </div>
                                    </div>
                                `).join('')}
                            </body>
                            </html>
                        `;
                        printWindow.document.write(printableContent);
                        printWindow.document.close();
                        printWindow.print();
                    }} style={{ ...btnStyle, background: 'var(--primary)' }}>Print Cards</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
                        <label style={{ fontSize: 12 }}>Tail boost:</label>
                        <input type="range" min="0" max="4" step="0.05" value={tailBoost} onChange={e => setTailBoost(Number(e.target.value))} />
                        <div style={{ width: 56, fontSize: 12, textAlign: 'right' }}>x{(1 + tailBoost).toFixed(2)}</div>
                    </div>
                </div>
            </div>

            {/* grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(10, 44px)',
                gap: 8,
                background: 'var(--muted-surface)',
                padding: 12,
                borderRadius: 12,
                boxShadow: '0 8px 30px var(--card-shadow)'
            }}>
                {numbers.map(n => {
                    const isDrawn = drawn.includes(n);
                    const playersWhoPicked = players.filter(pl => pl.picks.includes(n));
                    const pickCount = playersWhoPicked.length;
                    const isHit = pickCount > 0 && isDrawn;
                    // tile background: prefer hit (green), drawn (orange), otherwise white
                    const tileColor = isHit ? 'var(--hit)' : (isDrawn ? 'var(--drawn)' : 'var(--surface)');
                    const textColor = isHit ? 'var(--surface)' : 'var(--text)';
                    // compute which players (if any) specifically hit this tile
                    const playersWhoHit = playersWhoPicked.filter(pl => drawn.includes(n));
                    // construct stacked ring shadows for players who hit (concentric rings)
                    let computedBoxShadow = recentDraw === n ? '0 12px 36px var(--card-shadow)' : '0 6px 18px var(--card-shadow)';
                    if (playersWhoHit.length > 0) {
                        const rings = playersWhoHit.map((pl, i) => `0 0 0 ${2 + i * 2}px ${hexToRgba(playerColor(pl.id), 0.85)}`).join(', ');
                        // add the hit glow after the colored rings (theme-aware)
                        computedBoxShadow = rings + `, 0 6px 18px ${hexToRgba('var(--hit)', 0.18)}`;
                    }
                    return (
                        <motion.div
                            key={n}
                            onClick={() => togglePick(n)}
                            whileTap={{ scale: 0.96 }}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.14 }}
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: showResults ? 'default' : 'pointer',
                                userSelect: 'none',
                                fontWeight: 700,
                                color: textColor,
                                background: tileColor,
                                boxShadow: computedBoxShadow,
                                position: 'relative',
                                transition: 'transform 220ms ease',
                                transform: activeSwitch ? 'scale(1.04)' : 'scale(1)'
                            }}
                        >
                            {n}
                            {/* if multiple players picked this number, render small color dots */}
                            {pickCount > 0 && (
                                <div style={{ position: 'absolute', bottom: 4, left: 4, right: 4, display: 'flex', gap: 4, justifyContent: 'center' }}>
                                    {playersWhoPicked.slice(0, 6).map(pl => (
                                        <div key={pl.id} title={pl.name} style={{ width: 10, height: 10, borderRadius: '50%', background: playerColor(pl.id), opacity: 1, boxShadow: '0 0 4px rgba(0,0,0,0.3)' }} />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* results / info */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                <div style={infoBoxStyle}>Drawn: <strong>{drawn.length}</strong></div>
                <div style={infoBoxStyle}>Recent: <strong style={{ color: 'var(--drawn)' }}>{recentDraw || '—'}</strong></div>
                {showResults && (
                    <div style={infoBoxStyle}>
                        Results calculated
                    </div>
                )}
            </div>

            {/* players panel */}
            <div style={{ display: 'flex', gap: 12, marginTop: 12, width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                {players.map((pl, idx) => {
                    const res = results.find(r => r.id === pl.id);
                    // precompute probabilities & expected return for this player's spots
                    const spots = pl.picks.length;
                    const probs = [];
                    for (let k = 0; k <= spots; k++) probs.push(hyperProb(spots, k));
                    // expected multiplier according to the (possibly) tail-boosted payout table
                    const tableBase = payoutTable[spots] || {};
                    const table = applyTailBoostToTable(spots, tailBoost, 3, tableBase);
                    const expectedMultiplier = probs.reduce((acc, p, k) => {
                        const m = table[k] || 0;
                        return acc + p * m;
                    }, 0);
                    const expectedReturnPct = (expectedMultiplier * 100).toFixed(2);
                    return (
                        <div key={pl.id} style={{ minWidth: 220, background: 'var(--surface)', padding: 8, borderRadius: 10, boxShadow: '0 8px 20px var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <div style={{ width: 12, height: 12, borderRadius: 12, background: playerColor(pl.id) }} />
                                <input value={pl.name} onChange={e => setPlayers(prev => prev.map(p => p.id === pl.id ? { ...p, name: e.target.value } : p))} style={{ flex: 1, border: 0, fontWeight: 700 }} />
                                <button onClick={() => activatePlayer(pl.id, { clearPicks: false })} style={{ ...btnStyle, padding: '6px 8px', background: activePlayerId === pl.id ? 'var(--active)' : 'var(--primary)' }}>{activePlayerId === pl.id ? 'Active' : 'Make Active'}</button>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8, fontSize: 12 }}>
                                    <input type="checkbox" checked={!!editingMap[pl.id]} onChange={e => setEditingMap(m => ({ ...m, [pl.id]: e.target.checked }))} />
                                    <span style={{ fontSize: 12 }}>Edit</span>
                                </label>
                                <button onClick={() => removePlayer(pl.id)} title="Remove player" style={{ ...btnStyle, padding: '6px 8px', marginLeft: 8, background: 'var(--danger)', color: 'var(--surface)' }}>Remove</button>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <label style={{ fontSize: 12 }}>Bet:</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={pl.bet}
                                    onChange={e => {
                                        const raw = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
                                        const num = raw === '' ? 0 : Number(raw);
                                        setPlayers(prev => prev.map(p => p.id === pl.id ? { ...p, bet: num } : p));
                                    }}
                                    onBlur={e => {
                                        let v = e.target.value;
                                        if (v === '') {
                                            setPlayers(prev => prev.map(p => p.id === pl.id ? { ...p, bet: 0.1 } : p));
                                            return;
                                        }
                                        v = v.toString().replace(',', '.').replace(/[^0-9.]/g, '');
                                        const num = Math.max(0.1, parseFloat(v) || 0.1);
                                        setPlayers(prev => prev.map(p => p.id === pl.id ? { ...p, bet: +num.toFixed(2) } : p));
                                    }}
                                    style={{ width: 80 }}
                                />
                                <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>Spots: <strong>{pl.picks.length}</strong> / {spotLimit}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => quickPick(pl.id)} style={btnStyle} disabled={showResults}>QuickPick</button>
                                <button onClick={() => setPlayers(prev => prev.map(p => p.id === pl.id ? { ...p, picks: [] } : p))} style={{ ...btnStyle, background: 'var(--muted)' }}>Clear Picks</button>
                                <button onClick={() => setPlayers(prev => prev.map(p => p.id === pl.id ? { ...p, picks: p.picks.slice(0, spotLimit) } : p))} style={{ ...btnStyle, background: 'var(--accent)' }}>Trim to {spotLimit}</button>
                                <button onClick={() => { const q = randomSample(80, Math.min(spotLimit, 80)); setPlayers(prev => prev.map(p => p.id === pl.id ? { ...p, picks: q } : p)); }} style={{ ...btnStyle, background: 'var(--purple)' }}>QuickPick {spotLimit}</button>
                                <button onClick={() => {
                                    const spots = pl.picks.length;
                                    const tableBase = payoutTable[spots] || {};
                                    const table = applyTailBoostToTable(spots, tailBoost, 3, tableBase);
                                    const printWindow = window.open('', '_blank');
                                    const printableContent = `
                                        <html>
                                        <head>
                                            <title>Keno Card - ${pl.name}</title>
                                            <style>
                                                body { font-family: Arial, sans-serif; margin: 20px; text-align: center; }
                                                .card { border: 1px solid #ccc; padding: 20px; margin: 0 auto; max-width: 400px; }
                                                .card h2 { margin-top: 0; }
                                                .picks { margin: 10px 0; font-size: 16px; }
                                                .payouts { margin-top: 20px; }
                                                .payouts table { width: 100%; border-collapse: collapse; }
                                                .payouts th, .payouts td { border: 1px solid #000; padding: 5px; text-align: center; }
                                                .payouts th { background-color: #f0f0f0; }
                                            </style>
                                        </head>
                                        <body>
                                            <div class="card">
                                                <h2>${pl.name}</h2>
                                                <p>Bet: ${pl.bet} Birr | Game ID: ${gameId}</p>
                                                <div class="picks"><strong>Picks:</strong> ${pl.picks.sort((a, b) => a - b).join(', ')}</div>
                                                <div class="payouts">
                                                    <h3>Possible Wins</h3>
                                                    <table>
                                                        <tr><th>Hits</th><th>Multiplier</th><th>Payout</th></tr>
                                                        ${Array.from({ length: spots + 1 }, (_, k) => {
                                        const mult = table[k] || 0;
                                        const payout = +(pl.bet * mult).toFixed(2);
                                        return `<tr><td>${k}</td><td>x${(+mult).toFixed(2)}</td><td>${payout} Birr</td></tr>`;
                                    }).join('')}
                                                    </table>
                                                </div>
                                            </div>
                                        </body>
                                        </html>
                                    `;
                                    printWindow.document.write(printableContent);
                                    printWindow.document.close();
                                    printWindow.print();
                                }} style={{ ...btnStyle, background: 'var(--primary)' }}>Print Card</button>
                            </div>
                            {activePlayerId === pl.id && (
                                <div style={{ marginTop: 8, background: 'var(--muted-surface)', padding: 8, borderRadius: 8, border: '1px solid var(--card-border)' }}>
                                    <div style={{ fontSize: 13, fontWeight: 700 }}>Probabilities ({spots}-spot)</div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                                        <div>Expected return:</div>
                                        <div style={{ fontWeight: 800 }}>{expectedReturnPct}%</div>
                                        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>Multiplier: x{expectedMultiplier.toFixed(3)}</div>
                                    </div>
                                    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                                        {probs.map((p, k) => {
                                            const mult = (table && (table[k] || 0));
                                            return (
                                                <div key={k} style={{ fontSize: 12, padding: 6, background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--card-border)' }}>
                                                    <div style={{ fontWeight: 700 }}>{k} hits</div>
                                                    <div style={{ color: 'var(--text)' }}>x{(+mult).toFixed(2)}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {showResults && res && (
                                <div style={{ marginTop: 6, background: 'var(--muted-surface)', padding: 8, borderRadius: 8 }}>
                                    <div>Hits: <strong style={{ color: 'var(--hit)' }}>{res.hits}</strong></div>
                                    <div>Payout: <strong>{Math.ceil(res.payout)} Birr</strong> (x{res.multiplier})</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* small legend */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <div style={legendItem('var(--surface)', 'var(--text)')}>Available</div>
                <div style={legendItem('var(--accent)', 'var(--surface)')}>Picked</div>
                <div style={legendItem('var(--drawn)', 'var(--surface)')}>Drawn</div>
                <div style={legendItem('var(--hit)', 'var(--surface)')}>Hit</div>
            </div>
        </div>
    );
}

// small styles
const btnStyle = {
    padding: '10px 14px',
    borderRadius: 10,
    border: 'none',
    background: 'var(--primary)',
    color: 'var(--surface)',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 8px 20px var(--card-shadow)'
};

const infoBoxStyle = {
    background: 'var(--surface)',
    padding: '8px 12px',
    borderRadius: 8,
    boxShadow: '0 8px 20px var(--card-shadow)',
    fontSize: 13
};

const legendItem = (bg, color) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    background: bg,
    color,
    borderRadius: 8,
    border: '1px solid var(--card-border)',
    fontSize: 12,
    fontWeight: 700,
    boxShadow: '0 6px 18px var(--card-shadow)'
});

// player color helper — generate unique color for each player ID using HSL
const playerColor = (id) => {
    const hue = (Math.abs(id) * 137.5) % 360; // golden angle approximation for distinct hues
    return `hsl(${hue}, 70%, 50%)`;
};

// hexToRgba now accepts either a hex string like "#ffaa00" or a CSS var string like "var(--player-1)".
const hexToRgba = (input, a = 1) => {
    let hex = input || '';
    try {
        if (hex.startsWith('var(')) {
            // resolve CSS variable from root
            const varName = hex.slice(4, -1).trim();
            const rootVal = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
            if (rootVal) hex = rootVal;
        }
    } catch (e) {
        // ignore and continue
    }
    if (!hex || !hex.startsWith('#')) return `rgba(0,0,0,${a})`;
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const bigint = parseInt(full, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
};
