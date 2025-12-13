
import React, { useState, useRef } from "react";
import "./plinko.css";

// Configurable constants
const DEFAULT_BALANCE = 1000;
const DEFAULT_WAGER = 10;

// Function to generate slot multipliers with lowest in the middle, higher at edges
// Ensures the expected payout (sum p_i * multiplier_i) == (1 - houseEdge)
function getSlotMultipliers(houseEdge) {
    // Number of slots = PEG_ROWS + 1
    const slotCount = PEG_ROWS + 1;
    const mid = Math.floor(slotCount / 2);
    // Base raw payout shape
    const maxPayout = 10;
    const minPayout = 0.1;
    const raw = [];
    for (let i = 0; i < slotCount; i++) {
        const dist = Math.abs(i - mid) / mid;
        const payout = minPayout + (maxPayout - minPayout) * Math.pow(dist, 2);
        raw.push(payout);
    }

    // Compute exact slot probabilities as binomial distribution: P(k) = C(N,k)/2^N
    const N = PEG_ROWS;
    const probs = [];
    function comb(n, k) {
        if (k < 0 || k > n) return 0;
        k = Math.min(k, n - k);
        let res = 1;
        for (let i = 1; i <= k; i++) {
            res = res * (n - (k - i)) / i;
        }
        return res;
    }
    let expectedRaw = 0;
    for (let k = 0; k <= N; k++) {
        const p = comb(N, k) / Math.pow(2, N);
        probs.push(p);
        expectedRaw += raw[k] * p;
    }

    const desiredReturn = Math.max(0, 1 - houseEdge);
    const scale = expectedRaw > 0 ? (desiredReturn / expectedRaw) : (1 - houseEdge);

    // Apply scale and round to 2 decimals
    const multipliers = raw.map(v => Number((v * scale).toFixed(2)));
    return multipliers;
}

const DEFAULT_HOUSE_EDGE = 0.05; // 5%
const PEG_ROWS = 14; // More rows for more pegs

export default function Plinko() {
    // State
    const [balance, setBalance] = useState(DEFAULT_BALANCE);
    const [wager, setWager] = useState(DEFAULT_WAGER);
    const [houseEdge, setHouseEdge] = useState(DEFAULT_HOUSE_EDGE);
    const [dropping, setDropping] = useState(false);
    const [result, setResult] = useState([]); // array of { slot, payout }
    const [balls, setBalls] = useState([]); // array of visible balls
    const [ballsToDrop, setBallsToDrop] = useState(1);
    const animationRef = useRef();
    const slotMultipliers = getSlotMultipliers(houseEdge);


    // Compute peg positions and render pegs in a triangular grid
    const pegRadius = 4.5;
    const BALL_RADIUS = 5.5; // smaller ball radius for improved slot dynamics
    const boardWidth = 700; // board width constant
    const rowSpacing = 32;

    function computePegPositions() {
        const positions = [];
        for (let row = 0; row < PEG_ROWS; row++) {
            const pegsInRow = row + 1;
            const colSpacing = boardWidth / (PEG_ROWS);
            const left = (boardWidth / 2) - ((pegsInRow - 1) * colSpacing / 2);
            for (let col = 0; col < pegsInRow; col++) {
                const x = left + col * colSpacing;
                const y = 32 + row * rowSpacing;
                positions.push({ x, y, r: pegRadius, row, col });
            }
        }
        return positions;
    }

    function renderPegs() {
        const pegs = computePegPositions();
        return pegs.map((p, i) => (
            <circle
                key={`peg-${p.row}-${p.col}`}
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill="#ffd27a"
                stroke="#e6f6f7"
                strokeWidth="1.1"
            />
        ));
    }

    // Render slots at the bottom
    function renderSlots() {
        const slotWidth = 28;
        const slotY = 32 + PEG_ROWS * 32;
        // Align slots under the gaps between the last row of pegs
        const boardWidth = 700;
        const pegsInLastRow = PEG_ROWS;
        const colSpacing = boardWidth / PEG_ROWS;
        return slotMultipliers.map((mult, i) => {
            // Position: start at left edge, then every colSpacing
            const firstPegX = (boardWidth / 2) - ((pegsInLastRow - 1) * colSpacing / 2);
            const x = firstPegX - colSpacing / 2 + i * colSpacing;
            return (
                <g key={`slot-${i}`}>
                    <rect
                        x={x - slotWidth / 2}
                        y={slotY}
                        width={slotWidth}
                        height={15}
                        rx={5}
                        fill="#0ea5a4"
                        stroke="#ffd27a"
                        strokeWidth="1.1"
                    />
                    <text
                        x={x}
                        y={slotY + 11}
                        textAnchor="middle"
                        fontSize="12"
                        fill="#ffd27a"
                    >
                        {mult.toFixed(2)}x
                    </text>
                </g>
            );
        });
    }

    // Physics-based bouncy ball implementation
    const pegsRef = useRef([]);
    const ballsRef = useRef([]); // underlying physics objects
    const rafRef = useRef(null);

    function dropBall() {
        const count = Math.max(1, Math.min(50, Math.floor(ballsToDrop)));
        const totalCost = wager * count;
        if (dropping || wager < 1 || totalCost > balance) return;
        setDropping(true);
        setResult([]);
        setBalance(b => b - totalCost);

        const pegs = computePegPositions();
        pegsRef.current = pegs;

        const boardMid = boardWidth / 2;
        const startY = 16;
        const ballR = BALL_RADIUS;
        const colSpacing = boardWidth / PEG_ROWS;
        const slotY = 32 + PEG_ROWS * rowSpacing;

        // Create N balls with slight offsets and initial random vx
        const newBalls = [];
        const timestamp = Date.now();
        for (let i = 0; i < count; i++) {
            // All balls start from the center top of the board
            const startX = boardMid;
            const b = { id: `${timestamp}-${i}`, x: startX, y: startY, vx: (Math.random() - 0.5) * 30, vy: 0, settled: false };
            newBalls.push(b);
        }

        ballsRef.current = newBalls.slice();
        setBalls(newBalls.map(b => ({ id: b.id, x: b.x, y: b.y })));

        // Physics parameters
        let last = performance.now();
        const gravity = 1600; // px / s^2
        // Restitution controls bounce energy. Increased by 20% from previous value.
        const restitution = 0.34 * 1.2; // = 0.408
        const airDrag = 0.999;

        function step(now) {
            const dt = Math.min(0.032, (now - last) / 1000);
            last = now;

            const active = ballsRef.current;
            let anyMoving = false;
            for (const b of active) {
                if (b.settled) continue;
                anyMoving = true;
                b.vy += gravity * dt;
                b.vx *= Math.pow(airDrag, dt * 60);
                b.x += b.vx * dt;
                b.y += b.vy * dt;

                // collisions with pegs
                for (const peg of pegsRef.current) {
                    const dx = b.x - peg.x;
                    const dy = b.y - peg.y;
                    const dist2 = dx * dx + dy * dy;
                    const minDist = peg.r + ballR;
                    if (dist2 < minDist * minDist) {
                        const dist = Math.sqrt(dist2) || 0.0001;
                        const nx = dx / dist;
                        const ny = dy / dist;
                        const vDotN = b.vx * nx + b.vy * ny;
                        b.vx = b.vx - 2 * vDotN * nx;
                        b.vy = b.vy - 2 * vDotN * ny;
                        b.vx *= restitution;
                        b.vy *= restitution;
                        b.x = peg.x + nx * (minDist + 0.5);
                        b.y = peg.y + ny * (minDist + 0.5);
                        b.vx += (Math.random() - 0.5) * 60;
                    }
                }

                // walls
                if (b.x - ballR < 0) {
                    b.x = ballR;
                    b.vx = Math.abs(b.vx) * restitution;
                }
                if (b.x + ballR > boardWidth) {
                    b.x = boardWidth - ballR;
                    b.vx = -Math.abs(b.vx) * restitution;
                }

                // floor / slots
                if (b.y + ballR >= slotY) {
                    const firstPegX = (boardWidth / 2) - ((PEG_ROWS - 1) * colSpacing / 2);
                    const relative = b.x - (firstPegX - colSpacing / 2);
                    let slot = Math.round(relative / colSpacing);
                    slot = Math.max(0, Math.min(PEG_ROWS, slot));
                    const slotCenterX = firstPegX - colSpacing / 2 + slot * colSpacing;
                    b.x = slotCenterX;
                    b.y = slotY;
                    b.vx = 0;
                    b.vy = 0;
                    b.settled = true;
                    // award payout for this ball
                    const payout = wager * slotMultipliers[slot];
                    setTimeout(() => {
                        setResult(prev => [...prev, { slot, payout }]);
                        setBalance(bb => bb + payout);
                    }, 80);
                }
            }

            // update visible positions
            setBalls(active.map(b => ({ id: b.id, x: b.x, y: b.y })));

            // if any still moving, continue loop
            if (active.some(b => !b.settled)) {
                rafRef.current = requestAnimationFrame(step);
            } else {
                // all settled
                setDropping(false);
            }
        }

        rafRef.current = requestAnimationFrame(step);
    }

    // Simulate ball path and animate


    // Improved Plinko physics: row-by-row, bounce left/right, smooth vertical progress

    // (legacy path animator removed) Physics-based multi-ball implementation is used instead.

    // Render the SVG board
    function renderBoard() {
        return (
            <div className="plinko-canvas-wrap">
                <svg
                    className="plinko-canvas"
                    width={700}
                    height={PEG_ROWS * 32 + 60}
                    viewBox={`0 0 700 ${PEG_ROWS * 32 + 60}`}
                >
                    {/* Pegs */}
                    {renderPegs()}
                    {/* Slots */}
                    {renderSlots()}
                    {/* Balls */}
                    {balls.map(b => (
                        <circle
                            key={b.id}
                            cx={b.x}
                            cy={b.y}
                            r={BALL_RADIUS}
                            fill="#ff6b6b"
                            stroke="#fff"
                            strokeWidth="2"
                            style={{ filter: 'drop-shadow(0 2px 8px #ff6b6b88)' }}
                        />
                    ))}
                </svg>
                <div className="slots">
                    {slotMultipliers.map((mult, i) => (
                        <div className="slot" key={i}>
                            <div className="slot-multiplier">{mult.toFixed(2)}x</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Controls
    function renderControls() {
        return (
            <div className="plinko-controls">
                <div className="control-row">
                    <label>Balance:</label>
                    <span>{balance.toFixed(2)}</span>
                </div>
                <div className="control-row">
                    <label>Wager:</label>
                    <input
                        type="number"
                        min={1}
                        max={balance}
                        value={wager}
                        onChange={e => setWager(Number(e.target.value))}
                        disabled={dropping}
                    />
                </div>
                <div className="control-row">
                    <label># Balls:</label>
                    <input
                        type="number"
                        min={1}
                        max={50}
                        value={ballsToDrop}
                        onChange={e => setBallsToDrop(Number(e.target.value))}
                        disabled={dropping}
                        style={{ width: 72 }}
                    />
                </div>
                <div className="control-row">
                    <label>House Edge:</label>
                    <input
                        type="range"
                        min={0}
                        max={0.2}
                        step={0.01}
                        value={houseEdge}
                        onChange={e => setHouseEdge(Number(e.target.value))}
                        disabled={dropping}
                        style={{ width: 120 }}
                    />
                    <span>{(houseEdge * 100).toFixed(0)}%</span>
                </div>
                <button
                    className="btn primary"
                    onClick={dropBall}
                    disabled={dropping || wager < 1 || (wager * Math.max(1, ballsToDrop)) > balance}
                >
                    Drop Ball(s)
                </button>
                {result.length > 0 && (
                    <div className="stats">
                        <div>{result.length} ball(s) settled.</div>
                        <div>Total Payout: {result.reduce((s, r) => s + r.payout, 0).toFixed(2)}</div>
                        <div>Last results: {result.slice(-6).map((r, idx) => `#${idx + 1}: slot ${r.slot + 1} (${r.payout.toFixed(2)})`).join(', ')}</div>
                    </div>
                )}
            </div>
        );
    }

    // Cleanup animation on unmount
    React.useEffect(() => {
        return () => {
            // cancel any pending frame or timeout
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (animationRef.current) clearTimeout(animationRef.current);
        };
    }, []);

    return (
        <div className="plinko-root">
            {renderBoard()}
            {renderControls()}
        </div>
    );
}
