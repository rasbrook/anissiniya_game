function mulberry32(seed) {
    // ensure integer seed
    let t = seed >>> 0;
    return function () {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

const seededShuffle = (array, rng) => {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

// sampleNumbers with seeded RNG
const sampleNumbersSeeded = (min, max, count, rng) => {
    const pool = [];
    for (let n = min; n <= max; n++) pool.push(n);
    const shuffled = seededShuffle(pool, rng);
    return shuffled.slice(0, count);
};

// Generate a bingo card deterministically for a given player id (string or number)
export const generateBingoCardForId = (id) => {
    // derive numeric seed from id
    const seed = Number(String(id).replace(/\D/g, '')) || 0;
    const rng = mulberry32(seed + 1); // offset to avoid zero-seed edge

    // columns ranges, sampled deterministically
    const B = sampleNumbersSeeded(1, 15, 5, rng);
    const I = sampleNumbersSeeded(16, 30, 5, rng);
    const N = sampleNumbersSeeded(31, 45, 4, rng); // center will be FREE
    const G = sampleNumbersSeeded(46, 60, 5, rng);
    const O = sampleNumbersSeeded(61, 75, 5, rng);

    // build rows (5 rows x 5 columns)
    const rows = Array.from({ length: 5 }, (_, r) => {
        return [
            String(B[r]).padStart(2, '0'),
            String(I[r]).padStart(2, '0'),
            '', // N column value or FREE
            String(G[r]).padStart(2, '0'),
            String(O[r]).padStart(2, '0')
        ];
    });

    // insert N column values; middle is FREE
    let nIdx = 0;
    for (let r = 0; r < 5; r++) {
        if (r === 2) rows[r][2] = 'FREE';
        else {
            rows[r][2] = String(N[nIdx]).padStart(2, '0');
            nIdx++;
        }
    }
    return rows;
};

/**
 * generateAllCards(total = 150)
 * returns an object: { "1": card, "2": card, ... }
 * deterministic per player id
 */
export const generateAllCards = (total = 150) => {
    const cards = {};
    for (let i = 1; i <= total; i++) {
        cards[String(i)] = generateBingoCardForId(i);
    }
    return cards;
};

export default generateAllCards;
