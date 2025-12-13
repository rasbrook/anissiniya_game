import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const BallGrid = ({
    groupedAll,
    pickedSet,
    ballColors,
    maxBalls,
    remainingBalls,
    pickedBall,
    pickedRef,
    isPicking,
    initialized,
    stopPicking,
    initPicking,
    resumePicking,
    handleStopAndShowWinners,
    selectedPlayers,
    amount
}) => (
    <div style={{ minWidth: 220, alignContent: 'center', alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence>
            {pickedBall && pickedBall !== "All balls picked!" ? (
                <motion.div
                    ref={pickedRef}
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
            ) : <h1>No ball Remaining</h1>}
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
                    if (isPicking) {
                        stopPicking();
                    } else {
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
                {['B', 'I', 'N', 'G', 'O'].map((letter, rowIdx) => {
                    const balls = groupedAll[letter];
                    return (
                        <React.Fragment key={letter}>
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
);

export default BallGrid;
