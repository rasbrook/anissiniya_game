
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { accentColor, maincolor, secondaryColor, ballB, ballI, ballN, ballG, ballO, resolveCssVar } from "../constants/color";
import { largeFontSize } from "../constants/fontsizes";
import generateAllCards from "./cartels"; // new import
import customCartels from "./custumcartel";
import { useAuthStore } from "../store/authStore";
import { SupabaseHost } from "../../supabase";

const bingoBalls = [
    'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15',
    'I16', 'I17', 'I18', 'I19', 'I20', 'I21', 'I22', 'I23', 'I24', 'I25', 'I26', 'I27', 'I28', 'I29', 'I30',
    'N31', 'N32', 'N33', 'N34', 'N35', 'N36', 'N37', 'N38', 'N39', 'N40', 'N41', 'N42', 'N43', 'N44', 'N45',
    'G46', 'G47', 'G48', 'G49', 'G50', 'G51', 'G52', 'G53', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59', 'G60',
    'O61', 'O62', 'O63', 'O64', 'O65', 'O66', 'O67', 'O68', 'O69', 'O70', 'O71', 'O72', 'O73', 'O74', 'O75'
];
// use shared color constants (fall back to CSS variables if any are missing)
// Resolve CSS variables to concrete color strings at runtime (falls back to var(...) if not available)
const ballColors = {
    B: resolveCssVar(ballB) || 'var(--ball-B)',
    I: resolveCssVar(ballI) || 'var(--ball-I)',
    N: resolveCssVar(ballN) || 'var(--ball-N)',
    G: resolveCssVar(ballG) || 'var(--ball-G)',
    O: resolveCssVar(ballO) || 'var(--ball-O)'
};

const player = Array.from({ length: 150 }, (_, i) => String(i + 1));
////console.log(player)

const Balldisplay = (props) => {

    const [gameStarted, setGameStarted] = useState(false);
    const [pickedBall, setPickedBall] = useState(null);
    const [remainingBalls, setRemainingBalls] = useState([...bingoBalls]);
    const [amount, setAmount] = useState(0)
    const { userId } = useAuthStore();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState(0);
    const intervalRef = useRef(null);
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


    // Track picked balls for display
    const [pickedBallsList, setPickedBallsList] = useState([]);
    // NEW: UI flag for whether automatic picking is active
    const [isPicking, setIsPicking] = useState(false);
    // NEW: track whether a run has been initialized (prevents ref error)
    const [initialized, setInitialized] = useState(false);
    // NEW: chosen win rule (one | two | bingo)
    const [winType, setWinType] = useState("one");

    // NEW: all player cards (generated once).
    // Start from generated cards, then overlay any `customCartels` entries so
    // custom cards take priority while preserving any missing generated ones.
    const _initialCards = (() => {
        const generated = generateAllCards(150);
        if (customCartels && Object.keys(customCartels).length > 0) {
            for (const [k, v] of Object.entries(customCartels)) {
                generated[String(k)] = v;
            }
        }
        return generated;
    })();
    const allCardsRef = useRef(_initialCards);

    // NEW: winners modal state
    const [winners, setWinners] = useState([]); // array of player ids (strings)
    const [showWinners, setShowWinners] = useState(false);

    // set of called number strings (e.g. "01","15") used to render overlays
    const [winningPickedSet, setWinningPickedSet] = useState(new Set());

    // Import all ball audio files at build time so paths are resolved correctly
    // and work on case-sensitive hosts. Use Vite's new glob options to return
    // URLs: `query: '?url'` with `import: 'default'` and `eager: true`.
    const _audioModules = import.meta.glob('../assets/balls/ball_audio/*.mp3', { eager: true, query: '?url', import: 'default' });
    const audioMap = Object.fromEntries(Object.entries(_audioModules).map(([p, url]) => {
        const parts = p.split('/');
        const file = parts[parts.length - 1];
        const name = file.replace(/\.mp3$/i, '').toUpperCase();
        return [name, url];
    }));

    const speak = (pickedBall) => {
        if (!pickedBall) return Promise.resolve();
        const key = String(pickedBall).toUpperCase();
        const src = audioMap[key];
        if (!src) {
            // No audio for this value (could be control strings like "All balls picked!")
            return Promise.resolve();
        }
        const audio = new Audio(src);
        return audio.play().catch(err => {
            console.warn('Audio play blocked or failed:', err);
        });
    };


    // //console.log(amount)
    ////console.log(gameStarted)

    // NEW: refs to avoid double-pick race conditions
    const remainingRef = useRef([...bingoBalls]);
    const isPickingRef = useRef(false);
    // ref to the big picked ball element for GSAP animation
    const pickedRef = useRef(null);

    // Replace pickRandomBall to use refs and a simple lock
    const pickRandomBall = () => {
        // prevent re-entry
        if (isPickingRef.current) return;
        isPickingRef.current = true;

        // use mutable ref as source of truth for remaining balls
        const remaining = remainingRef.current;
        if (!remaining || remaining.length === 0) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            setPickedBall("All balls picked!");
            speak("All balls picked!");
            setIsPicking(false); // ensure UI updates
            isPickingRef.current = false;
            return;
        }

        const idx = Math.floor(Math.random() * remaining.length);
        const [ball] = remaining.splice(idx, 1); // remove from ref list
        remainingRef.current = remaining;

        // sync React state
        setRemainingBalls([...remaining]); // update visible remaining
        setPickedBall(ball);
        speak(ball);
        setPickedBallsList(list => [...list, ball]);

        // small timeout to ensure next interval tick can proceed
        setTimeout(() => {
            isPickingRef.current = false;
        }, 50);
    };

    // startPicking must reset the ref plus state and ensure single interval
    const startPicking = () => {
        if (intervalRef.current) return;
        // reset source of truth and state
        remainingRef.current = [...bingoBalls];
        setRemainingBalls([...bingoBalls]);
        setPickedBallsList([]);
        setPickedBall(null);

        // mark active and start ticks
        setIsPicking(true);
        // pick one immediately, then start interval
        pickRandomBall();
        intervalRef.current = setInterval(pickRandomBall, 4000);
    }

    const deductAmount = async () => {
        const tobededucted = selectedPlayers.length * amount * 0.10
        const newBalance = userData.balance - tobededucted;
        const { data, error } = await SupabaseHost
            .from('host')
            .update({ balance: newBalance })
            .eq('id', userId);
        //console.log(newBalance)
        //console.log(data)
        if (error) {
            console.error("Error updating balance:", error);
        }
    }
    // NEW: start a fresh picking run (reset state + start interval)
    const initPicking = () => {
        if (intervalRef.current) return;
        // reset source of truth and state
        remainingRef.current = [...bingoBalls];
        setRemainingBalls([...bingoBalls]);
        setPickedBallsList([]);
        setPickedBall(null);

        // mark active and start ticks
        setIsPicking(true);
        // pick one immediately, then start interval
        pickRandomBall();
        intervalRef.current = setInterval(pickRandomBall, 3000);
        setInitialized(true);
        deductAmount()

    };



    // NEW: resume picking without resetting previous picks
    const resumePicking = () => {
        if (intervalRef.current) return;
        // if no remaining balls, do nothing
        if (!remainingRef.current || remainingRef.current.length === 0) {
            setIsPicking(false);
            return;
        }
        setIsPicking(true);
        // pick one immediately and then continue on interval
        pickRandomBall();
        intervalRef.current = setInterval(pickRandomBall, 3000);
    };

    const stopPicking = () => {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsPicking(false);
    };



    const [selectedPlayers, setSelectedPlayers] = useState([]);
    //console.log(selectedPlayers)

    const handlePlayerClick = (num) => {
        setSelectedPlayers(prev =>
            prev.includes(num) ? prev : [...prev, num]
        );
    };
    //console.log(selectedPlayers.length * amount)
    //console.log(selectedPlayers)
    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalInput, setModalInput] = useState("");

    // Add card from modal
    const handleAddCard = () => {
        const num = modalInput.trim();
        if (
            num &&
            /^\d+$/.test(num) &&
            Number(num) >= 1 &&
            Number(num) <= 150 &&
            !selectedPlayers.includes(num)
        ) {
            setSelectedPlayers(prev => [...prev, num]);
        }
        setModalInput("");
        setShowModal(false);
    };

    // Helper to group balls by letter
    const groupBalls = (balls) => {
        const groups = { B: [], I: [], N: [], G: [], O: [] };
        balls.forEach(ball => {
            const letter = ball[0];
            if (groups[letter]) groups[letter].push(ball);
        });
        return groups;
    };
    //console.log(bingoBalls.filter((_, i) => i !== remainingBalls))


    // Helper: evaluate whether card meets winType given picked numbers set
    const hasWinningLine = (card, pickedNumSet, rule = "one") => {
        // helper to check single line (row/col/diag)
        const checkLines = () => {
            const lines = [];
            // rows
            for (let r = 0; r < 5; r++) {
                let ok = true;
                for (let c = 0; c < 5; c++) {
                    const val = card[r][c];
                    if (val === "FREE") continue;
                    if (!pickedNumSet.has(val)) { ok = false; break; }
                }
                if (ok) lines.push({ type: "row", idx: r });
            }
            // cols
            for (let c = 0; c < 5; c++) {
                let ok = true;
                for (let r = 0; r < 5; r++) {
                    const val = card[r][c];
                    if (val === "FREE") continue;
                    if (!pickedNumSet.has(val)) { ok = false; break; }
                }
                if (ok) lines.push({ type: "col", idx: c });
            }
            // diag TL-BR
            {
                let ok = true;
                for (let i = 0; i < 5; i++) {
                    const val = card[i][i];
                    if (val === "FREE") continue;
                    if (!pickedNumSet.has(val)) { ok = false; break; }
                }
                if (ok) lines.push({ type: "diag", idx: 0 });
            }
            // diag TR-BL
            {
                let ok = true;
                for (let i = 0; i < 5; i++) {
                    const val = card[i][4 - i];
                    if (val === "FREE") continue;
                    if (!pickedNumSet.has(val)) { ok = false; break; }
                }
                if (ok) lines.push({ type: "diag", idx: 1 });
            }
            return lines;
        };

        if (rule === "bingo") {
            // full house: every non-FREE cell must be in pickedNumSet
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const val = card[r][c];
                    if (val === "FREE") continue;
                    if (!pickedNumSet.has(val)) return false;
                }
            }
            return true;
        }

        const lines = checkLines();
        if (rule === "one") {
            return lines.length > 0;
        }
        if (rule === "two") {
            return lines.length >= 2;
        }
        if (rule === "three") {
            return lines.length >= 3;
        }
        if (rule === "four") {
            return lines.length >= 4;
        }
        // fallback to single-line
        return lines.length > 0;
    };

    // NEW: compute winners from pickedBallsList according to selected winType
    const computeWinners = () => {
        // build set of picked numeric strings padded to 2 digits, e.g. '01','15','30'
        const pickedNums = new Set(pickedBallsList.map(b => {
            const n = b.slice(1); // remove letter
            return String(Number(n)).padStart(2, "0");
        }));
        const cards = allCardsRef.current;
        const result = [];
        for (const [playerId, card] of Object.entries(cards)) {
            if (hasWinningLine(card, pickedNums, winType)) result.push(playerId);
        }
        return { result, pickedNums };
    };

    // update Stop button to stop and show winners
    const handleStopAndShowWinners = () => {
        // pause picking
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsPicking(false);

        // compute and show winners, also store called numbers for overlay
        const { result: found, pickedNums } = computeWinners();
        setWinners(found);
        setWinningPickedSet(pickedNums);
        setShowWinners(true);
    };

    // animate the large picked-ball element when a new ball appears
    useEffect(() => {
        const fetchUserData = async () => {
            //console.log(userId)
            if (userId) {
                const { data, error } = await SupabaseHost
                    .from('host')
                    .select('*')
                    .eq('id', userId)
                    .single();
                if (data) {
                    //console.log(data)
                    setUserData(data);
                } else {
                    console.error('Error fetching user data:', error);
                }
            }
            setLoading(false);
        };
        fetchUserData();
        if (!pickedBall || !pickedRef.current) return;
        try {
            gsap.fromTo(pickedRef.current, { scale: 0.6, rotation: -24, y: -40, autoAlpha: 0 }, { scale: 1, rotation: 0, y: 0, autoAlpha: 1, duration: 0.62, ease: 'bounce.out' });
        } catch (e) { /* ignore */ }
    }, [pickedBall, userId]);

    // helper: convert a hex color or CSS var("--name") to rgba(r,g,b,a)
    // default to using the accent token so theme-controlled values are preferred
    const hexToRgba = (input = 'var(--accent)', alpha = 0.22) => {
        let hex = input || 'var(--accent)';
        try {
            if (typeof hex === 'string' && hex.startsWith('var(')) {
                const name = hex.slice(4, -1).trim();
                const computed = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
                if (computed) hex = computed;
            }
        } catch (e) { }
        if (!hex || !hex.startsWith('#')) return `rgba(0,0,0,${alpha})`;
        const h = hex.replace('#', '');
        const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
        const bigint = parseInt(full, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // --- Add: animated hint-card component (insert near top of component file) ---
    const CardHint = ({ winType }) => {
        // small mapping for label + description
        const info = {
            one: { title: '1 Line', desc: 'Any single row, column or diagonal.' },
            two: { title: '2 Lines', desc: 'Any two distinct lines.' },
            three: { title: '3 Lines', desc: 'Any three distinct lines.' },
            four: { title: '4 Lines', desc: 'Any four distinct lines.' },
            bingo: { title: 'Full House', desc: 'All numbers (full card).' }
        };

        const item = info[winType] || info.one;

        // simple small preview generator: show 5x5 mini-grid and highlight number of lines required
        const lineCount = winType === 'bingo' ? 5 : (winType === 'four' ? 4 : (winType === 'three' ? 3 : (winType === 'two' ? 2 : 1)));

        const previewCells = Array.from({ length: 25 }).map((_, i) => {
            // for visuals mark center as FREE
            const isCenter = i === 12;
            return { id: i, label: isCenter ? '●' : '' };
        });

        return (
            <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                whileHover={{ scale: 1.02 }}
                style={{
                    width: 220,
                    padding: 14,
                    borderRadius: 12,
                    background: 'var(--surface)',
                    boxShadow: '0 12px 30px var(--card-shadow)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    alignItems: 'stretch',
                    marginTop: 100,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--secondary)' }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{item.desc}</div>
                    </div>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: hexToRgba(secondaryColor, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {/* small icon */}
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--secondary)' }} />
                    </div>
                </div>

                {/* mini card preview */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3, marginTop: 6 }}>
                    {previewCells.map((c, idx) => {
                        // highlight some rows to visually indicate lineCount (simple heuristic)
                        const row = Math.floor(idx / 5);
                        const highlight = row < lineCount; // top rows illustrate required lines
                        return (
                            <div key={c.id} style={{
                                width: 26,
                                height: 18,
                                borderRadius: 4,
                                background: highlight ? hexToRgba(accentColor || 'var(--accent)', 0.18) : 'var(--surface)',
                                border: '1px solid var(--card-border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                color: highlight ? 'var(--accent)' : 'var(--muted)',
                                fontWeight: 700
                            }}>
                                {c.label}
                            </div>
                        );
                    })}
                </div>

                <motion.div
                    key={winType}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28 }}
                    style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}
                >
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Need lines:
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--secondary)' }}>{winType === 'bingo' ? 'ALL' : lineCount}</div>
                </motion.div>
            </motion.div>
        );
    };
    // --- End added component ---

    if (gameStarted) {
        const groupedAll = groupBalls(bingoBalls);
        const pickedSet = new Set(pickedBallsList);

        // Calculate max balls in a group for grid columns
        const maxBalls = Math.max(...Object.values(groupedAll).map(arr => arr.length));

        return (
            <div
                style={{
                    overflowY: 'hidden',
                    minHeight: "100vh",
                    background: 'var(--bg)',
                    padding: 30,
                    borderRadius: 8,
                    boxShadow: "0 4px 16px var(--card-shadow)",
                    marginTop: 50,

                }}
            >
                <button onClick={() => {
                    setGameStarted(false);
                    setAmount(0);
                    setSelectedPlayers([]);
                    setPickedBall(null);
                    setRemainingBalls([...bingoBalls]);
                    setPickedBallsList([]);
                    setIsPicking(false);
                    setInitialized(false);
                    setWinners([]);
                    setShowWinners(false);
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                    }
                }} style={{ backgroundColor: 'var(--surface)', color: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 16, marginRight: 8 }}>Go back</button>

                <div style={{ overflowY: 'hidden', fontSize: 32, fontWeight: 700, color: "var(--text)", marginBottom: 20, textAlign: "center", letterSpacing: 2 }}>
                    🎱 abissinia-Bingo Ball Draw 🎱
                </div>
                <div style={{ display: 'flex', flexWrap: "wrap", alignItems: 'flex-start', gap: 40, justifyContent: "center", }}>
                    <div style={{ minWidth: 220, alignContent: 'center', alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
                        <AnimatePresence>
                            {pickedBall && pickedBall !== "All balls picked!" && (
                                <motion.div
                                    ref={pickedRef}
                                    //key={pickedBall}
                                    initial={{ scale: 1, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 1, opacity: 0 }}
                                    transition={{ duration: 2 }}
                                    style={{
                                        margin: "0 auto 20px auto",
                                        width: 120,
                                        height: 120,
                                        borderRadius: "50%",
                                        background: ballColors[pickedBall[0]] || "var(--surface)",
                                        boxShadow: "0 8px 32px var(--card-shadow)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 40,
                                        alignSelf: "center",
                                        fontWeight: "bold",
                                        color: "var(--surface)",
                                        border: "4px solid var(--surface)",


                                    }}
                                >
                                    {pickedBall}
                                </motion.div>
                            ) || <h1>No ball Remaining</h1>}
                        </AnimatePresence>
                        <div style={{ marginBottom: 16 }}>
                            <button
                                style={{
                                    background: isPicking ? 'var(--accent)' : 'var(--hit)',
                                    color: 'var(--surface)',
                                    border: 'none',
                                    borderRadius: 8,
                                    padding: '8px 18px',
                                    fontSize: 16,
                                    marginRight: 8,
                                    cursor: 'pointer'
                                }}
                                onClick={() => {
                                    // toggle: if currently picking -> pause, else resume (no reset)
                                    if (isPicking) {
                                        stopPicking();
                                    } else {
                                        // if never initialized (e.g. game started via Play?), fall back to init
                                        if (!initialized) initPicking();
                                        else resumePicking();
                                    }
                                }}
                            >
                                {isPicking ? "Pause" : "Resume"}
                            </button>
                            <button
                                style={{
                                    background: 'var(--danger)',
                                    color: 'var(--surface)',
                                    border: 'none',
                                    borderRadius: 8,
                                    padding: '8px 18px',
                                    fontSize: 16,
                                    cursor: 'pointer'
                                }}
                                onClick={handleStopAndShowWinners}
                            >Stop</button>
                        </div>
                        <div style={{ fontSize: 16, color: "var(--muted)", marginBottom: 10 }}>
                            Remaining: <span style={{ fontWeight: 700 }}>{remainingBalls.length}</span>
                        </div>
                    </div>



                    {/* All balls grid: 5 columns (BINGO), rows for each ball */}
                    <div>
                        <h2 style={{ textAlign: "center", color: "var(--text)", marginBottom: 10, fontSize: 22, letterSpacing: 1 }}>All Balls</h2>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateRows: 'repeat(5, 1fr)',
                                gridTemplateColumns: `repeat(${maxBalls}, auto)`,
                                gap: 6,
                                background: 'var(--surface)',
                                borderRadius: 12,
                                boxShadow: '0 2px 12px var(--card-shadow)',
                                padding: 10,
                                minWidth: 520,
                                maxWidth: 900,
                                margin: '0 auto'
                            }}
                        >
                            {/* Header column (B I N G O) as first cell in each row */}
                            {['B', 'I', 'N', 'G', 'O'].map((letter, rowIdx) => {
                                // For each row, render all balls for that letter horizontally
                                const balls = groupedAll[letter];
                                return (
                                    <React.Fragment key={letter}>
                                        {/* Render the row: first cell is the letter, then balls */}
                                        <div
                                            style={{
                                                gridRow: rowIdx + 1,
                                                gridColumn: 1,
                                                fontWeight: 'bold',
                                                fontSize: 32,
                                                color: ballColors[letter],
                                                textAlign: "center",
                                                alignSelf: "center",



                                            }}
                                        >
                                            {letter}
                                        </div>
                                        {Array.from({ length: maxBalls }).map((_, colIdx) => {
                                            const ball = balls[colIdx];
                                            return (
                                                <AnimatePresence key={letter + colIdx}>
                                                    <div
                                                        style={{
                                                            marginRight: 5,
                                                            gridRow: rowIdx + 1,
                                                            gridColumn: colIdx + 2,
                                                            display: "flex",
                                                            justifyContent: "center"
                                                        }}
                                                    >
                                                        {ball ? (
                                                            <motion.div
                                                                key={ball}
                                                                initial={pickedSet.has(ball) ? { scale: 0.7, opacity: 0.5 } : false}
                                                                animate={pickedSet.has(ball) ? { scale: 1.15, opacity: 1 } : { scale: 1, opacity: 1 }}
                                                                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                                                                style={{
                                                                    fontSize: 16,
                                                                    color: pickedSet.has(ball) ? "var(--surface)" : ballColors[letter],
                                                                    fontWeight: pickedSet.has(ball) ? "bold" : 500,
                                                                    background: pickedSet.has(ball) ? ballColors[letter] : 'var(--muted-surface)',
                                                                    borderRadius: 8,
                                                                    boxShadow: pickedSet.has(ball) ? "0 2px 8px var(--card-shadow)" : undefined,
                                                                    transition: "background 0.2s, color 0.2s",
                                                                    padding: "4px 0",
                                                                    textAlign: "center",
                                                                    minWidth: 38,
                                                                    marginBottom: 5,
                                                                    margin: "0 2px"
                                                                }}
                                                            >
                                                                {ball}
                                                            </motion.div>
                                                        ) : (
                                                            <div style={{ minWidth: 38 }}></div>
                                                        )}
                                                    </div>
                                                </AnimatePresence>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                    {/* Winner info */}
                    <div style={{
                        background: 'var(--surface)',
                        borderRadius: 12,
                        boxShadow: '0 2px 12px var(--card-shadow)',
                        padding: 24,
                        minWidth: 180,
                        textAlign: "center"
                    }}>
                        <h1 style={{ color: "var(--text)", fontSize: 22, marginBottom: 10 }}>
                            Winner Take
                        </h1>
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0.5 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 18 }}
                            style={{ fontSize: '24px', color: 'var(--hit)', fontWeight: 700, marginBottom: 10 }}
                        >
                            {Number.parseInt(selectedPlayers.length * amount * 0.90)} Birr
                        </motion.div>
                    </div>
                </div>

                {/* Winners modal */}
                {showWinners && (
                    <div style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 2000
                    }}>
                        <div style={{ background: 'var(--surface)', padding: 20, borderRadius: 12, maxHeight: "80vh", overflow: "auto", width: "90%", maxWidth: 900 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <h2>Winners ({winners.length})</h2>
                                <button onClick={() => setShowWinners(false)} style={{ padding: "6px 12px", cursor: "pointer" }}>Close</button>
                            </div>

                            {winners.length === 0 && <div>No winners found.</div>}

                            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                                {[...winners]
                                    .sort((a, b) => {
                                        // selected cartels first
                                        const aSelected = selectedPlayers.includes(a);
                                        const bSelected = selectedPlayers.includes(b);
                                        if (aSelected === bSelected) return 0;
                                        return aSelected ? -1 : 1;
                                    })
                                    .map(pid => {
                                        const card = allCardsRef.current[pid];
                                        const isCardSelected = selectedPlayers.includes(pid); // pre-selected before game
                                        return (
                                            <div
                                                key={pid}
                                                style={{
                                                    border: isCardSelected ? "2px solid var(--secondary)" : "1px solid var(--card-border)",
                                                    padding: 8,
                                                    borderRadius: 8,
                                                    width: 180,
                                                    background: isCardSelected ? "linear-gradient(135deg, var(--card-highlight) 0%, var(--surface) 100%)" : 'var(--surface)',
                                                    boxShadow: isCardSelected ? "0 2px 12px var(--card-shadow)" : undefined,
                                                    transition: "background 0.2s, border 0.2s"
                                                }}
                                            >
                                                <div style={{ fontWeight: 700, marginBottom: 6 }}>{isCardSelected ? "★ " : ""}Player {pid}</div>
                                                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                                                    {["B", "I", "N", "G", "O"].map(h => <div key={h} style={{ textAlign: "center", fontWeight: 700 }}>{h}</div>)}
                                                    {card.map((row, rIdx) =>
                                                        row.map((cell, cIdx) => {
                                                            const isCalled = cell !== 'FREE' && winningPickedSet.has(String(cell));
                                                            // called numbers take priority; otherwise highlight whole card if pre-selected
                                                            const bg = isCalled
                                                                ? 'var(--call-bg)'
                                                                : (isCardSelected
                                                                    ? 'var(--card-highlight)'
                                                                    : (cell === "FREE" ? 'var(--muted-surface)' : 'var(--surface)'));
                                                            return (
                                                                <div key={rIdx + "-" + cIdx} style={{
                                                                    position: 'relative',
                                                                    textAlign: "center",
                                                                    padding: "6px 4px",
                                                                    borderRadius: 4,
                                                                    border: "1px solid var(--card-border)",
                                                                    minHeight: 28,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: 12,
                                                                    fontWeight: cell === "FREE" ? 700 : 600,
                                                                    background: bg,
                                                                    color: isCalled ? 'var(--surface)' : 'var(--text)'
                                                                }}>
                                                                    {cell}
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        )
    }

    return (
        <div
            style={{
                minHeight: "100vh",
                background: 'var(--bg)',
                padding: 30, marginTop: 50,
            }}
        >

            <h1 style={{ color: 'var(--text)', fontSize: largeFontSize, position: 'relative', left: 0 }}>abissinia-Bingo</h1>
            {/* Modal for entering card number */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.25 }}
                        style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000
                        }}>
                        <motion.div
                            initial={{ y: 60, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 60, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            style={{
                                background: 'var(--surface)',
                                padding: 30,
                                borderRadius: 16,
                                boxShadow: '0 4px 24px var(--card-shadow)',
                                minWidth: 320
                            }}>
                            <h2 style={{ fontSize: 22, color: "var(--text)", marginBottom: 16 }}>Enter Card Number (1-150)</h2>
                            <input
                                type="number"
                                min={1}
                                max={150}
                                value={modalInput}
                                onChange={e => setModalInput(e.target.value.replace(/[^0-9]/g, ''))}
                                style={{
                                    width: '100%',
                                    fontSize: 20,
                                    marginBottom: 16,
                                    borderRadius: 8,
                                    border: "1px solid var(--card-border)",
                                    padding: "8px 12px"
                                }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <button
                                    style={{
                                        background: 'var(--muted)',
                                        color: 'var(--surface)',
                                        border: 'none',
                                        borderRadius: 8,
                                        padding: '8px 18px',
                                        fontSize: 16,
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => setShowModal(false)}
                                >Cancel</button>
                                <button
                                    style={{
                                        background: 'var(--primary)',
                                        color: 'var(--surface)',
                                        border: 'none',
                                        borderRadius: 8,
                                        padding: '8px 18px',
                                        fontSize: 16,
                                        cursor: 'pointer',
                                        opacity: (!modalInput ||
                                            Number(modalInput) < 1 ||
                                            Number(modalInput) > 150 ||
                                            selectedPlayers.includes(modalInput)) ? 0.5 : 1
                                    }}
                                    onClick={handleAddCard}
                                    disabled={
                                        !modalInput ||
                                        Number(modalInput) < 1 ||
                                        Number(modalInput) > 150 ||
                                        selectedPlayers.includes(modalInput)
                                    }
                                >
                                    Add
                                </button>
                            </div>
                            {modalInput && (Number(modalInput) < 1 || Number(modalInput) > 150) && (
                                <div style={{ color: 'red', marginTop: 8 }}>Number must be between 1 and 150</div>
                            )}
                            {modalInput && selectedPlayers.includes(modalInput) && (
                                <div style={{ color: 'red', marginTop: 8 }}>Card already selected</div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 32 }}>
                <div>
                    <h1 style={{ color: "var(--text)", fontSize: 28, marginBottom: 12 }}>List Of Players Card</h1>
                    <div style={{
                        width: '60vw',
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 12
                    }}>
                        {player.map((i) => (
                            <motion.div
                                key={i}
                                whileTap={{ scale: 1.15, rotate: 8 }}
                                animate={selectedPlayers.includes(i) ? { scale: 1.08 } : { scale: 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                                onClick={() => {
                                    setSelectedPlayers(prev =>
                                        prev.includes(i)
                                            ? prev.filter(num => num !== i)
                                            : [...prev, i]
                                    );
                                }}
                                style={{
                                    height: 70,
                                    width: 70,
                                    margin: 4,
                                    background: selectedPlayers.includes(i)
                                        ? `linear-gradient(135deg, var(--secondary) 0%, var(--accent) 100%)`
                                        : 'var(--muted-surface)',
                                    color: selectedPlayers.includes(i) ? 'var(--surface)' : 'var(--text)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 16,
                                    border: selectedPlayers.includes(i) ? `2px solid var(--secondary)` : '1px solid var(--card-border)',
                                    fontWeight: 700,
                                    fontSize: 22,
                                    boxShadow: selectedPlayers.includes(i)
                                        ? '0 2px 12px var(--card-shadow)'
                                        : "0 1px 4px var(--card-shadow)",
                                    transition: "all 0.2s"
                                }}
                            >
                                {i}
                            </motion.div>
                        ))}
                    </div>
                </div>
                <div style={{
                    minWidth: 220,
                    background: 'var(--surface)',
                    borderRadius: 16,
                    boxShadow: '0 2px 12px var(--card-shadow)',
                    padding: 24,
                    height: "fit-content"
                }}>
                    <h1 style={{ color: "var(--text)", fontSize: 22, marginBottom: 10 }}>
                        Betting Amount per Player
                    </h1>
                    <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        style={{
                            fontSize: 20,
                            borderRadius: 8,
                            border: "1px solid var(--card-border)",
                            padding: "8px 12px",
                            width: "100%",
                            marginBottom: 18
                        }}
                    />
                    <h1 style={{ color: "var(--text)", fontSize: 22, marginBottom: 10 }}>
                        Winner Take
                    </h1>
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0.5 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 18 }}
                        style={{ fontSize: '28px', color: 'var(--hit)', fontWeight: 700, marginBottom: 18 }}
                    >
                        {Number.parseInt(selectedPlayers.length * amount * 0.90)} Birr
                    </motion.div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 12,
                        marginBottom: 8,
                        maxWidth: 560,
                        width: '100%',
                        padding: 10,
                        borderRadius: 12,
                        background: 'var(--surface)',
                        boxShadow: '0 8px 20px var(--card-shadow)'
                    }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', minWidth: 80 }}>Win rule</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[
                                { key: 'one', label: '1 Line' },
                                { key: 'two', label: '2 Lines' },
                                { key: 'three', label: '3 Lines' },
                                { key: 'four', label: '4 Lines' },
                                { key: 'bingo', label: 'Full House' }
                            ].map(opt => (
                                <button
                                    key={opt.key}
                                    onClick={() => setWinType(opt.key)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: 10,
                                        border: winType === opt.key ? `2px solid var(--secondary)` : '1px solid var(--card-border)',
                                        background: winType === opt.key ? hexToRgba(secondaryColor, 0.12) : 'var(--muted-surface)',
                                        color: winType === opt.key ? 'var(--secondary)' : 'var(--text)',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        minWidth: 84,
                                        textAlign: 'center',
                                        boxShadow: winType === opt.key ? '0 6px 14px var(--card-shadow)' : 'none'
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        style={{
                            background: 'var(--primary)',
                            color: 'var(--surface)',
                            border: 'none',
                            borderRadius: 8,
                            padding: '10px 24px',
                            fontSize: 18,
                            marginBottom: 10,
                            cursor: 'pointer',
                            width: '100%',
                            marginTop: 8,
                            boxShadow: '0 2px 8px var(--card-shadow)'
                        }}
                        onClick={() => setShowModal(true)}
                    >
                        Enter Card
                    </button>
                    {(() => {
                        const required = Number(selectedPlayers.length * amount * 0.10) || 0;
                        const betAmount = Number(amount) || 0;
                        const amountTooLow = betAmount <= 10;
                        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
                        const insufficient = Number(balance) < required || amountTooLow || isOffline;
                        return (
                            <>
                                <button
                                    style={{
                                        backgroundColor: insufficient ? 'var(--muted)' : 'var(--secondary)',
                                        color: 'var(--text)',
                                        border: 'none',
                                        borderRadius: 8,
                                        padding: '10px 24px',
                                        fontSize: 18,
                                        width: '100%',
                                        marginTop: 10,
                                        cursor: insufficient ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 2px 8px var(--card-shadow)',
                                        opacity: insufficient ? 0.5 : 1
                                    }}
                                    onClick={() => { setGameStarted(true); initPicking(); }}
                                    disabled={insufficient}
                                >
                                    {insufficient ? (isOffline ? 'No internet connection' : amountTooLow ? 'Minimum bet is 10 birr' : 'Insufficient Balance') : 'Play'}
                                </button>
                                {insufficient && amountTooLow && !isOffline && (
                                    <p style={{
                                        color: 'var(--accent)',
                                        fontSize: 14,
                                        textAlign: 'center',
                                        marginTop: 8,
                                        marginBottom: 0
                                    }}>
                                        Bet amount must be greater than 10 birr
                                    </p>
                                )}
                                {insufficient && isOffline && (
                                    <p style={{
                                        color: 'var(--accent)',
                                        fontSize: 14,
                                        textAlign: 'center',
                                        marginTop: 8,
                                        marginBottom: 0
                                    }}>
                                        Please check your internet connection
                                    </p>
                                )}
                            </>
                        )
                    })()}
                </div>
            </div>
        </div>
    );

};

export default Balldisplay;