/**
 * Report logic for Competency Learning Kit
 */

/**
 * Calculates scores for a list of competencies based on evidence.
 * @param {Array} competencies - List of competency objects
 * @param {Array} evidenceList - List of evidence objects
 * @param {number} startTime - Start of time range (ms timestamp)
 * @param {number} endTime - End of time range (ms timestamp)
 * @returns {Object} Map of competencyId to score (0-100)
 */
function calculateCompetencyScores(competencies, evidenceList, startTime, endTime) {
    const scores = {};
    const competencyMap = new Map();

    // Pass 1: Group all relevant evidence by competency ID in a single iteration O(E)
    evidenceList.forEach(ev => {
        // Use numeric timestamp if available, otherwise parse
        const timestamp = typeof ev.timestamp === 'number' ? ev.timestamp : new Date(ev.timestamp).getTime();
        if (timestamp > endTime) return;

        let pairs = [];
        if (Array.isArray(ev.ratings)) {
            pairs = ev.ratings;
        } else {
            const rawPairs = (ev.ratings || "").split(';');
            rawPairs.forEach(p => {
                const [id, rating] = p.split(',');
                if (id) pairs.push({ id: id, score: parseFloat(rating) });
            });
        }

        pairs.forEach(pair => {
            const cid = pair.id.toString();
            if (!competencyMap.has(cid)) competencyMap.set(cid, []);
            competencyMap.get(cid).push({ score: pair.score, timestamp: timestamp });
        });
    });

    // Pass 2: Calculate scores for each competency O(C)
    competencies.forEach(competency => {
        const competencyId = competency.id.toString();
        const allRatings = competencyMap.get(competencyId) || [];

        if (allRatings.length === 0) {
            return; // No evidence at all
        }

        const withinRange = allRatings.filter(r => r.timestamp >= startTime && r.timestamp <= endTime);

        if (withinRange.length > 0) {
            // Evaluated mean of evidence within range
            const sum = withinRange.reduce((acc, r) => acc + r.score, 0);
            scores[competencyId] = sum / withinRange.length;
        } else {
            // Highest score from evidence before the range
            const beforeRange = allRatings.filter(r => r.timestamp < startTime);
            if (beforeRange.length > 0) {
                scores[competencyId] = Math.max(...beforeRange.map(r => r.score));
            }
        }
    });

    return scores;
}

// Alias for backward compatibility
const calculateGoalScores = calculateCompetencyScores;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calculateCompetencyScores, calculateGoalScores };
}
