/**
 * Report logic for Open Proficiency Learning
 */

/**
 * Calculates scores for a list of goals based on evidence.
 * @param {Array} goals - List of goal objects
 * @param {Array} evidenceList - List of evidence objects
 * @param {number} startTime - Start of time range (ms timestamp)
 * @param {number} endTime - End of time range (ms timestamp)
 * @returns {Object} Map of goalId to score (0-100)
 */
function calculateGoalScores(goals, evidenceList, startTime, endTime) {
    const scores = {};

    goals.forEach(goal => {
        const goalId = goal.id.toString();
        
        // Extract ratings for this specific goal from all evidence
        const allRatings = [];
        evidenceList.forEach(ev => {
            // Evidence model: goal-id,rating;goal-id,rating
            const pairs = (ev.ratings || "").split(';');
            pairs.forEach(pair => {
                const [id, rating] = pair.split(',');
                if (id === goalId) {
                    allRatings.push({
                        score: parseFloat(rating),
                        timestamp: new Date(ev.timestamp).getTime()
                    });
                }
            });
        });

        if (allRatings.length === 0) {
            return; // No evidence at all
        }

        const withinRange = allRatings.filter(r => r.timestamp >= startTime && r.timestamp <= endTime);
        
        if (withinRange.length > 0) {
            // Evaluated mean of evidence within range
            const sum = withinRange.reduce((acc, r) => acc + r.score, 0);
            scores[goalId] = sum / withinRange.length;
        } else {
            // Highest score from evidence before the range
            const beforeRange = allRatings.filter(r => r.timestamp < startTime);
            if (beforeRange.length > 0) {
                scores[goalId] = Math.max(...beforeRange.map(r => r.score));
            }
        }
    });

    return scores;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calculateGoalScores };
}
