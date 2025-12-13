import React from "react";
import { motion } from "framer-motion";

const PlayerList = ({ player, selectedPlayers, setSelectedPlayers }) => (
    <div>
        <h1 style={{ color: "var(--text)", fontSize: 28, marginBottom: 12 }}>List Of Players Card</h1>
        <div style={{ width: '60vw', display: "flex", flexWrap: "wrap", gap: 12 }}>
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
);

export default PlayerList;
