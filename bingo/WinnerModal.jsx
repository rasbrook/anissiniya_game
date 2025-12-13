import React from "react";

const WinnerModal = ({ showWinners, setShowWinners, winners, selectedPlayers, allCardsRef, winningPickedSet }) => (
    showWinners ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
            <div style={{ background: 'var(--surface)', padding: 20, borderRadius: 12, maxHeight: "80vh", overflow: "auto", width: "90%", maxWidth: 900 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h2>Winners ({winners.length})</h2>
                    <button onClick={() => setShowWinners(false)} style={{ padding: "6px 12px", cursor: "pointer" }}>Close</button>
                </div>
                {winners.length === 0 && <div>No winners found.</div>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {[...winners]
                        .sort((a, b) => {
                            const aSelected = selectedPlayers.includes(a);
                            const bSelected = selectedPlayers.includes(b);
                            if (aSelected === bSelected) return 0;
                            return aSelected ? -1 : 1;
                        })
                        .map(pid => {
                            const card = allCardsRef.current[pid];
                            const isCardSelected = selectedPlayers.includes(pid);
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
    ) : null
);

export default WinnerModal;
