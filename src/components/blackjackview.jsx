import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// Basic Blackjack component
// - Single player vs dealer
// - Deck is shuffled, initial deal: player 2 cards, dealer 1 card shown + 1 hidden
// - Player can Hit or Stand. Dealer auto-plays to 17+.
// - Aces count as 1 or 11.
// - Uses CSS variables for colors so theme toggle applies.

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const buildDeck = () => {
	const d = [];
	for (const s of SUITS) {
		for (const r of RANKS) d.push({ suit: s, rank: r });
	}
	return d;
};

const shuffle = (arr) => {
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
};

const cardValue = (rank) => {
	if (rank === 'A') return 11;
	if (['J', 'Q', 'K'].includes(rank)) return 10;
	return Number(rank);
};

const scoreHand = (hand) => {
	let total = 0;
	let aces = 0;
	for (const c of hand) {
		total += cardValue(c.rank);
		if (c.rank === 'A') aces++;
	}
	// downgrade aces from 11 to 1 as needed
	while (total > 21 && aces > 0) { total -= 10; aces--; }
	return total;
};

const formatCard = (c) => `${c.rank}${c.suit}`;

export default function Blackjackview() {
	const [deck, setDeck] = useState([]);
	const [player, setPlayer] = useState([]);
	const [dealer, setDealer] = useState([]);
	const [message, setMessage] = useState('');
	const [inRound, setInRound] = useState(false);
	const [dealerHidden, setDealerHidden] = useState(true);
	// Betting / advanced features
	const [balance, setBalance] = useState(1000);
	const [betAmount, setBetAmount] = useState(10);
	const [betPlaced, setBetPlaced] = useState(false);
	const [currentBet, setCurrentBet] = useState(0);
	const [canDouble, setCanDouble] = useState(false);
	// advanced features
	const [insuranceOffered, setInsuranceOffered] = useState(false);
	const [insuranceBet, setInsuranceBet] = useState(0);
	const [tookInsurance, setTookInsurance] = useState(false);
	const [surrendered, setSurrendered] = useState(false);
	const [betHistory, setBetHistory] = useState([]); // {result, payout, bet, time}
	const [playerHands, setPlayerHands] = useState(null); // null or array of hands for split
	const [activeHandIdx, setActiveHandIdx] = useState(0);
	const [finishedHands, setFinishedHands] = useState(null); // array of booleans per split hand
	const [playerActed, setPlayerActed] = useState(false); // whether player took any action after deal
	const audioCtxRef = useRef(null);
	const [soundOn, setSoundOn] = useState(true);
	const [isDrawing, setIsDrawing] = useState(false);
	const isDrawingRef = useRef(false);
	const lastDrawRef = useRef(null);

	const startRound = (bet = null) => {
		// require bet placed before dealing
		if (!betPlaced && (bet === null || bet <= 0)) {
			setMessage('Place a bet before dealing.');
			return;
		}
		const newDeck = shuffle(buildDeck());
		const p = [newDeck.pop(), newDeck.pop()];
		const d = [newDeck.pop(), newDeck.pop()];
		setDeck(newDeck);
		setPlayer(p);
		setDealer(d);
		setInRound(true);
		setDealerHidden(true);
		setMessage('');
		const betToUse = betPlaced ? currentBet : bet || betAmount;
		setCurrentBet(betToUse);
		// allow double only at start of round
		setCanDouble(true);
		// reset advanced flags & split state
		setInsuranceOffered(false);
		setInsuranceBet(0);
		setTookInsurance(false);
		setSurrendered(false);
		setPlayerHands(null);
		setFinishedHands(null);
		setActiveHandIdx(0);
		setPlayerActed(false);
		// Dealer blackjack check before player acts: if dealer upcard is Ace or 10-value, peek for blackjack
		if (d[0] && ['A', '10', 'J', 'Q', 'K'].includes(d[0].rank)) {
			if (scoreHand([d[0], d[1]]) === 21) {
				setDealerHidden(false);
				setTimeout(() => evaluate(), 300);
				setMessage('Dealer has blackjack!');
				setInRound(false);
				return;
			}
		}
		// offer insurance if dealer upcard is Ace
		if (d[0] && d[0].rank === 'A') setInsuranceOffered(true);
		// play dealing sound
		playSound('deal');
	};

	const draw = (who) => {
		setDeck(prev => {
			if (prev.length === 0) return prev;
			const card = prev[prev.length - 1];
			const next = prev.slice(0, -1);
			if (who === 'player') setPlayer(pl => [...pl, card]);
			else setDealer(d => [...d, card]);
			return next;
		});
	};

	const drawhit = (who) => {
		setDeck(prev => {
			if (prev.length === 0) return prev;
			const card = prev[prev.length - 1];
			const next = prev.slice(0, -1);
			// assign a unique id for this draw and only apply the card append
			// from the last updater call to avoid duplicate appends in strict/dev mode
			const drawId = Math.random();
			lastDrawRef.current = drawId;
			setTimeout(() => {
				if (lastDrawRef.current !== drawId) return; // another draw superseded this one
				if (who === 'player') setPlayer(pl => [...pl, card]);
				else setDealer(d => [...d, card]);
			}, 0);
			return next;
		});
	};
	const playerHit = () => {
		if (!inRound || isDrawingRef.current) return;
		isDrawingRef.current = true;
		setIsDrawing(true);
		setPlayerActed(true);
		setCanDouble(false);
		setInsuranceOffered(false);
		if (playerHands && Array.isArray(playerHands)) {
			// hit on active split hand
			setDeck(prev => {
				if (prev.length === 0) return prev;
				const card = prev[prev.length - 1];
				const next = prev.slice(0, -1);
				setPlayerHands(hs => {
					const copy = hs.slice();
					copy[activeHandIdx] = [...copy[activeHandIdx], card];
					// if busted, mark finished and advance
					if (scoreHand(copy[activeHandIdx]) > 21) {
						setFinishedHands(f => {
							const arr = (f || []).slice(); arr[activeHandIdx] = true; return arr;
						});
						// advance to next unfinished hand
						setTimeout(() => {
							let nextIdx = activeHandIdx + 1;
							while (nextIdx < copy.length && finishedHands && finishedHands[nextIdx]) nextIdx++;
							if (nextIdx >= copy.length) {
								setDealerHidden(false); setTimeout(() => dealerPlay(), 200);
							} else setActiveHandIdx(nextIdx);
						}, 80);
					}
					return copy;
				});
				return next;
			});
		} else {
			// normal hit
			drawhit('player');
		}
		setTimeout(() => { isDrawingRef.current = false; setIsDrawing(false); }, 220);
	};

	const playerStand = () => {
		if (!inRound) return;
		setPlayerActed(true);
		setCanDouble(false);
		setInsuranceOffered(false);
		if (playerHands && Array.isArray(playerHands)) {
			// mark current hand finished and advance
			setFinishedHands(f => {
				const arr = (f || []).slice(); arr[activeHandIdx] = true; return arr;
			});
			// find next unfinished hand
			setTimeout(() => {
				let idx = activeHandIdx + 1;
				const fh = finishedHands || [];
				while (idx < (playerHands || []).length && fh[idx]) idx++;
				if (!playerHands || idx >= (playerHands || []).length) {
					setDealerHidden(false); setTimeout(() => dealerPlay(), 300);
				} else {
					setActiveHandIdx(idx);
				}
			}, 80);
		} else {
			setDealerHidden(false);
			setTimeout(() => dealerPlay(), 300);
		}
	};

	const dealerPlay = () => {
		setInRound(false);
		setDealerHidden(false);
		setTimeout(function step() {
			setDealer(d => {
				const s = scoreHand(d);
				let nextDeck = null;
				setDeck(prev => { nextDeck = prev; return prev; });
				if (s < 17 && nextDeck && nextDeck.length > 0) {
					const card = nextDeck[nextDeck.length - 1];
					// mutate via setDealer after
					setTimeout(() => setDealer(d2 => [...d2, card]), 120);
					setDeck(prev => prev.slice(0, -1));
					setTimeout(step, 220);
					return d;
				}
				// evaluate winner
				setTimeout(() => evaluate(), 200);
				return d;
			});
		}, 0);
	};

	const evaluate = () => {
		const dScore = scoreHand(dealer);
		let out = '';
		let totalPayout = 0;
		const results = [];
		const finalize = (desc, payout) => { out = desc; totalPayout += payout; results.push({ desc, payout }); };

		const resolveSingle = (hand, bet) => {
			const pScore = scoreHand(hand);
			if (pScore > 21) return { desc: `You busted (${pScore}). Dealer wins.`, payout: -bet };
			if (dScore > 21) return { desc: `Dealer busted (${dScore}). You win!`, payout: bet };
			// blackjack handling
			if (hand.length === 2 && pScore === 21 && !(dealer.length >= 2 && scoreHand([dealer[0], dealer[1]]) === 21)) {
				const payout = Math.round(bet * 1.5);
				return { desc: `Blackjack! You win ${payout} (3:2).`, payout };
			}
			if (pScore > dScore) return { desc: `You win (${pScore} vs ${dScore})!`, payout: bet };
			if (pScore < dScore) return { desc: `Dealer wins (${dScore} vs ${pScore}).`, payout: -bet };
			return { desc: `Push (${pScore}).`, payout: 0 };
		};

		if (!betPlaced || currentBet <= 0) { setMessage('No bet placed.'); return; }

		// surrender handling
		if (surrendered) {
			const payout = -Math.round(currentBet / 2);
			finalize(`Surrendered. You lose half (${-payout}).`, payout);
			setBalance(b => b + payout);
			setBetHistory(h => [{ time: Date.now(), bet: currentBet, result: 'surrender', payout }, ...h]);
			setMessage(`Surrendered. You lose ${-payout}.`);
			setBetPlaced(false);
			setCurrentBet(0);
			return;
		}

		// insurance resolution
		if (insuranceOffered && tookInsurance) {
			const dealerHasBJ = (dealer.length >= 2 && scoreHand([dealer[0], dealer[1]]) === 21);
			if (dealerHasBJ) {
				const insPayout = insuranceBet * 2;
				setBalance(b => b + insPayout);
			} else {
				setBalance(b => b - insuranceBet);
			}
		}

		// handle split
		if (playerHands && Array.isArray(playerHands) && playerHands.length > 0) {
			for (const hand of playerHands) {
				const res = resolveSingle(hand, currentBet);
				finalize(res.desc, res.payout);
				setBalance(b => b + res.payout);
			}
			setMessage(results.map(r => r.desc).join(' | '));
			setBetHistory(h => [{ time: Date.now(), bet: currentBet * playerHands.length, result: results.map(r => r.desc).join(' | '), payout: totalPayout }, ...h]);
			setBetPlaced(false);
			setCurrentBet(0);
			return;
		}

		// normal single-hand resolution
		const res = resolveSingle(player, currentBet);
		finalize(res.desc, res.payout);
		setBalance(b => b + res.payout);
		setMessage(out);
		setBetHistory(h => [{ time: Date.now(), bet: currentBet, result: out, payout: totalPayout }, ...h]);
		setBetPlaced(false);
		setCurrentBet(0);
	};

	useEffect(() => {
		// auto-evaluate when player gets over 21
		if (inRound) {
			const p = scoreHand(player);
			if (p > 21) {
				setDealerHidden(false);
				setInRound(false);
				setTimeout(() => evaluate(), 80);
			}
			// blackjack instant win
			if (player.length === 2 && scoreHand(player) === 21) {
				setDealerHidden(false);
				setInRound(false);
				setTimeout(() => evaluate(), 80);
			}
		}
	}, [player]);

	// initial state: wait for player to place bet and deal

	const restart = () => {
		setPlayer([]);
		setDealer([]);
		setMessage('');
		setInRound(false);
		setBetPlaced(false);
		setCurrentBet(0);
		setCanDouble(false);
		setInsuranceOffered(false);
		setInsuranceBet(0);
		setTookInsurance(false);
		setSurrendered(false);
		setPlayerHands(null);
		setFinishedHands(null);
		setActiveHandIdx(0);
		setPlayerActed(false);
	};

	// betting helpers
	const placeBet = () => {
		const amt = Number(betAmount) || 0;
		if (amt <= 0) { setMessage('Bet must be greater than 0'); return; }
		if (amt > balance) { setMessage('Insufficient balance for that bet'); return; }
		setBetPlaced(true);
		setCurrentBet(amt);
		setMessage(`Bet placed: ${amt}`);
	};

	const handleDeal = () => {
		if (!betPlaced) { setMessage('Place a bet first'); return; }
		startRound();
	};

	const handleDouble = () => {
		if (!inRound || !canDouble) return;
		const extra = currentBet;
		if (extra > balance) { setMessage('Insufficient balance to double down'); return; }
		setPlayerActed(true);
		setCurrentBet(cb => cb * 2);
		setCanDouble(false);
		setInsuranceOffered(false);
		// if split hands exist, apply simple behavior: double current bet overall and stand current hand
		if (playerHands && Array.isArray(playerHands)) {
			// mark hand finished and move on
			setFinishedHands(f => { const arr = (f || []).slice(); arr[activeHandIdx] = true; return arr; });
			setTimeout(() => {
				let idx = activeHandIdx + 1;
				const fh = finishedHands || [];
				while (idx < playerHands.length && fh[idx]) idx++;
				if (idx >= playerHands.length) { setDealerHidden(false); setTimeout(() => dealerPlay(), 300); }
				else setActiveHandIdx(idx);
			}, 120);
		} else {
			// draw one card then dealer plays
			drawhit('player');
			setTimeout(() => { setDealerHidden(false); setTimeout(() => dealerPlay(), 300); }, 220);
		}
	};

	const handleSurrender = () => {
		if (!inRound || player.length !== 2) return;
		setPlayerActed(true);
		setSurrendered(true);
		setDealerHidden(false);
		setInRound(false);
		setCanDouble(false);
		setInsuranceOffered(false);
		setTimeout(() => evaluate(), 120);
	};

	const offerInsurance = () => {
		// only allowed as first action after deal
		if (!insuranceOffered || !betPlaced || !inRound || playerActed || player.length !== 2) return;
		const ins = Math.floor(currentBet / 2);
		setInsuranceBet(ins);
		setTookInsurance(true);
		setMessage(`Insurance taken: ${ins}`);
		setCanDouble(false);
		setInsuranceOffered(false);
		setPlayerActed(true);
	};

	const handleSplit = () => {
		if (!inRound) return;
		let hands = playerHands && Array.isArray(playerHands) ? playerHands.slice() : [player.slice()];
		const hand = hands[activeHandIdx];
		if (!hand || hand.length !== 2 || hand[0].rank !== hand[1].rank) { setMessage('Can only split pairs'); return; }
		if (currentBet > balance) { setMessage('Insufficient balance to split'); return; }
		setDeck(prev => {
			const next = prev.slice();
			const c1 = next.pop();
			const c2 = next.pop();
			const newHands = [[hand[0], c1], [hand[1], c2]];
			// replace the hand at active index with the two new hands
			hands.splice(activeHandIdx, 1, ...newHands);
			setPlayerHands(hands);
			// update finishedHands array
			setFinishedHands(f => {
				const arr = (f || []).slice();
				arr.splice(activeHandIdx, 1, false, false);
				// if splitting aces, mark both finished (standard rule: one card only)
				if (hand[0].rank === 'A') { arr[activeHandIdx] = true; arr[activeHandIdx + 1] = true; }
				return arr;
			});
			// hold extra bet
			setBalance(b => b - currentBet);
			return next;
		});
		setMessage('Split into hands');
		setActiveHandIdx(0);
		setCanDouble(false);
		setInsuranceOffered(false);
		setPlayerActed(true);
	};

	const playSound = (type = 'click') => {
		if (!soundOn) return;
		try {
			if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
			const ctx = audioCtxRef.current;
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.connect(g); g.connect(ctx.destination);
			if (type === 'deal') { o.frequency.value = 700; }
			else if (type === 'win') { o.frequency.value = 880; }
			else if (type === 'lose') { o.frequency.value = 220; }
			else o.frequency.value = 440;
			g.gain.value = 0.001;
			o.start();
			g.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.01);
			g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
			o.stop(ctx.currentTime + 0.3);
		} catch (e) { /* ignore */ }
	};

	return (
		<div style={{ position: 'relative', padding: 18, background: 'var(--surface)', color: 'var(--text)', borderRadius: 12, boxShadow: '0 8px 30px var(--card-shadow)', maxWidth: 760 }}>
			{/* Rules box in the top-left corner */}
			<div style={{ position: 'fixed', left: 12, top: 200, width: 340, background: 'var(--muted-surface)', color: 'var(--text)', padding: 14, borderRadius: 8, border: '1px solid var(--card-border)', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', fontSize: 13, zIndex: 30 }}>
				<div style={{ fontWeight: 800, marginBottom: 8 }}>How to Play — Rules & Examples</div>
				<div style={{ maxHeight: 340, overflowY: 'auto', lineHeight: '1.3' }}>
					<p style={{ margin: '6px 0', fontWeight: 700 }}>Goal</p>
					<p style={{ margin: '4px 0' }}>Beat the dealer by having a hand value closer to 21 than the dealer, without going over 21 (busting).</p>
					<p style={{ margin: '6px 0', fontWeight: 700 }}>Card Values</p>
					<ul style={{ margin: '4px 0 8px 18px' }}>
						<li>Number cards (2–10) = face value.</li>
						<li>Face cards (J, Q, K) = 10.</li>
						<li>Ace = 11 or 1. It counts as 11 unless that would bust the hand, in which case it counts as 1.</li>
					</ul>
					<p style={{ margin: '6px 0', fontWeight: 700 }}>Deal</p>
					<p style={{ margin: '4px 0' }}>You and the dealer each get two cards. Your cards are face-up. The dealer shows one card face-up and one card face-down (the "hole" card).</p>
					<p style={{ margin: '6px 0', fontWeight: 700 }}>Blackjack</p>
					<p style={{ margin: '4px 0' }}>If your first two cards are an Ace and a 10-valued card (10, J, Q, K), that's a Blackjack and typically pays 3:2 (example: a $10 bet returns $15 profit).</p>
					<p style={{ margin: '6px 0', fontWeight: 700 }}>Player Options (first decision)</p>
					<ul style={{ margin: '4px 0 8px 18px' }}>
						<li><strong>Hit:</strong> take another card. You may hit repeatedly until you stand or bust.</li>
						<li><strong>Stand:</strong> stop and let the dealer play.</li>
						<li><strong>Double:</strong> double your initial bet, receive exactly one more card, then automatically stand. Allowed only on the first two cards.</li>
						<li><strong>Split:</strong> if your first two cards are a pair (same rank), you may split them into two separate hands. An extra bet equal to your original bet is placed for the new hand; each hand is then played independently. (This implementation supports a basic split—rules such as re-splitting or splitting Aces may be limited.)</li>
						<li><strong>Surrender:</strong> give up immediately and forfeit half your bet. Usually only allowed as your first action.</li>
					</ul>
					<p style={{ margin: '6px 0', fontWeight: 700 }}>Insurance</p>
					<p style={{ margin: '4px 0' }}>If the dealer's upcard is an Ace, you may buy insurance for up to half your bet. If the dealer has blackjack, insurance pays 2:1 (so it covers your original loss). If dealer doesn't have blackjack, insurance is lost.</p>
					<p style={{ margin: '6px 0', fontWeight: 700 }}>Dealer Rules & Outcomes</p>
					<ul style={{ margin: '4px 0 8px 18px' }}>
						<li>Dealer hits until their total is 17 or more (dealer stands on 17+).</li>
						<li><strong>Bust:</strong> a hand over 21 loses immediately.</li>
						<li><strong>Push:</strong> if your hand ties the dealer's, your bet is returned (no win/loss).</li>
					</ul>
					<p style={{ margin: '6px 0', fontStyle: 'italic', color: 'var(--muted)' }}>Examples: If you bet $10 and get Blackjack, you win $15 (3:2). If you double on $10, you put an extra $10 and will be standing after one more card (total bet $20).</p>
				</div>
			</div>
			<h2 style={{ marginTop: 0 }}>Blackjack</h2>
			<div style={{ display: 'flex', gap: 24 }}>
				<div style={{ flex: 1 }}>
					<div style={{ fontWeight: 700, marginBottom: 8 }}>Dealer {dealerHidden ? '(one hidden)' : ''}</div>
					<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
						{dealer.map((c, i) => (
							<div key={i} style={{ minWidth: 56, height: 80, borderRadius: 8, background: i === 1 && dealerHidden ? 'linear-gradient(90deg, #222, #333)' : 'var(--muted-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--card-border)', fontSize: 18 }}>
								{i === 1 && dealerHidden ? '??' : formatCard(c)}
							</div>
						))}
					</div>
					{!dealerHidden && <div style={{ marginTop: 8, color: 'var(--muted)' }}>Dealer score: {scoreHand(dealer)}</div>}
				</div>

				<div style={{ flex: 1 }}>
					<div style={{ fontWeight: 700, marginBottom: 8 }}>Player</div>
					{/* If split hands exist, render them with active highlight and switch buttons */}
					{playerHands && Array.isArray(playerHands) ? (
						<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
							{playerHands.map((hand, idx) => (
								<div key={idx} style={{ minWidth: 160, border: idx === activeHandIdx ? '2px solid var(--accent)' : '1px solid var(--card-border)', borderRadius: 8, padding: 8, background: idx === activeHandIdx ? 'var(--muted-surface)' : 'var(--surface)' }}>
									<div style={{ fontWeight: 600, marginBottom: 6 }}>Hand {idx + 1} {idx === activeHandIdx && '(Active)'}</div>
									<div style={{ display: 'flex', gap: 8 }}>
										{hand.map((c, i) => (
											<div key={i} style={{ minWidth: 56, height: 80, borderRadius: 8, background: 'var(--primary)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--card-border)', fontSize: 18 }}>{formatCard(c)}</div>
										))}
									</div>
									<div style={{ marginTop: 6, color: 'var(--muted)' }}>Score: {scoreHand(hand)}</div>
									<button onClick={() => setActiveHandIdx(idx)} disabled={activeHandIdx === idx} style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: idx === activeHandIdx ? 'var(--muted)' : 'var(--accent)', color: 'var(--surface)', border: 'none' }}>{activeHandIdx === idx ? 'Active' : 'Switch'}</button>
								</div>
							))}
						</div>
					) : (
						<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
							{player.map((c, i) => (
								<div key={i} style={{ minWidth: 56, height: 80, borderRadius: 8, background: 'var(--primary)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--card-border)', fontSize: 18 }}>{formatCard(c)}</div>
							))}
						</div>
					)}
					<div style={{ marginTop: 8, color: 'var(--muted)' }}>Player score: {playerHands && Array.isArray(playerHands) ? scoreHand(playerHands[activeHandIdx] || []) : scoreHand(player)}</div>
				</div>
			</div>

			<div style={{ marginTop: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<div style={{ fontWeight: 700 }}>Balance:</div>
					<div style={{ padding: '6px 10px', background: 'var(--muted-surface)', borderRadius: 8 }}>{balance}</div>
				</div>

				<div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
					<input type="number" min={1} value={betAmount} onChange={e => setBetAmount(Math.max(1, Number(e.target.value || 0)))} style={{ width: 100, padding: 8, borderRadius: 8, border: '1px solid var(--card-border)' }} />
					<button onClick={placeBet} disabled={betPlaced} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--primary)', color: 'var(--surface)', border: 'none' }}>Place Bet</button>
					<button onClick={handleDeal} disabled={inRound || !betPlaced} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--hit)', color: 'var(--surface)', border: 'none' }}>Deal</button>
					<button onClick={handleDouble} disabled={!inRound || !canDouble} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--secondary)', color: 'var(--surface)', border: 'none' }}>Double</button>
					<button onClick={playerHit} disabled={!inRound || isDrawing} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--hit)', color: 'var(--surface)', border: 'none' }}>Hit</button>
					<button onClick={playerStand} disabled={!inRound} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--primary)', color: 'var(--surface)', border: 'none' }}>Stand</button>
					<button onClick={restart} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--muted)', color: 'var(--surface)', border: 'none' }}>Restart</button>
				</div>
			</div>

			<div style={{ marginTop: 12, minHeight: 24, fontWeight: 700 }}>{message}</div>
		</div>
	);
}
