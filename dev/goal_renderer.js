/**
 * Goal Renderer for Open Proficiency Learning
 * Renders goals as slices in polar coordinates.
 */
class GoalRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.scale = 80; // Pixels per "level" (radius unit)
        this.centerX = canvas.width / 2;
        this.centerY = canvas.height / 2;
    }

    setDimensions(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.centerX = width / 2;
        this.centerY = height / 2;
    }

    /**
     * Renders a list of goals.
     * @param {Array} goals - List of goal objects
     * @param {string} selectedGoalId - ID of the currently selected goal for highlighting
     * @param {string} hoveredGoalId - ID of the currently hovered goal
     * @param {Object} scores - Map of goalId to score (0-100) for report mode
     */
    render(goals, selectedGoalId = null, hoveredGoalId = null, scores = null) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (!goals || goals.length === 0) {
            this.ctx.fillStyle = '#64748b';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('No goals to render', this.centerX, this.centerY);
            return;
        }

        // Calculate dynamic scale
        let maxRadius = 3;
        goals.forEach(g => {
            const r = parseFloat(g.endLevel) || 0;
            if (r > maxRadius) maxRadius = r;
        });
        
        // Add a small buffer and calculate scale
        const margin = 0.9;
        this.scale = (Math.min(this.canvas.width, this.canvas.height) / 2 * margin) / maxRadius;

        // Map goals by ID for parent lookup
        const goalMap = new Map();
        goals.forEach(g => goalMap.set(g.id.toString(), g));

        // Calculate absolute positions and store them for hit testing
        this.lastRenderedGoals = goals.map(g => {
            const absTheta = this.calculateAbsoluteTheta(g, goalMap);
            const score = scores ? scores[g.id.toString()] : null;
            return { ...g, absTheta, score };
        });

        // Filter goals if in report mode
        const goalsToRender = scores 
            ? this.lastRenderedGoals.filter(g => g.score !== undefined && g.score !== null)
            : this.lastRenderedGoals;

        // Pass 1: Draw all slices
        const anyHovered = hoveredGoalId !== null;
        goalsToRender.forEach(g => {
            this.drawSlice(g, selectedGoalId === g.id.toString(), hoveredGoalId === g.id.toString(), anyHovered);
        });

        // Pass 2: Draw all labels (ensure they are on top of everything)
        goalsToRender.forEach(g => {
            this.drawLabel(g, hoveredGoalId === g.id.toString(), anyHovered);
        });
    }

    calculateAbsoluteTheta(goal, goalMap) {
        let theta = parseFloat(goal.position) || 0;
        let current = goal;
        
        // Traverse up to find parent offsets
        while (current.parentId && current.parentId !== '-1') {
            const parent = goalMap.get(current.parentId.toString());
            if (!parent) break;
            theta += parseFloat(parent.position) || 0;
            current = parent;
        }
        
        // Offset by -PI/2 so 0 is North
        return theta - Math.PI / 2;
    }

    getContrastColor(hexColor) {
        if (!hexColor || hexColor.charAt(0) !== '#') return '#000000';
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        return yiq >= 128 ? '#000000' : '#ffffff';
    }

    getAdjustedOuterRadius(goal) {
        const innerRadius = parseFloat(goal.startLevel) * this.scale;
        const fullOuterRadius = parseFloat(goal.endLevel) * this.scale;
        
        if (goal.score !== undefined && goal.score !== null) {
            const score = Math.max(5, goal.score); // Clamp min to 5%
            return innerRadius + (fullOuterRadius - innerRadius) * (score / 100);
        }
        return fullOuterRadius;
    }

    drawSlice(goal, isSelected, isHovered, anyHovered) {
        const innerRadius = parseFloat(goal.startLevel) * this.scale;
        const outerRadius = this.getAdjustedOuterRadius(goal);
        const startAngle = goal.absTheta;
        const endAngle = goal.absTheta + (parseFloat(goal.width) || 0);

        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, outerRadius, startAngle, endAngle);
        this.ctx.arc(this.centerX, this.centerY, innerRadius, endAngle, startAngle, true);
        this.ctx.closePath();

        // Style
        const baseColor = goal.color || '#94a3b8';
        this.ctx.fillStyle = baseColor;
        this.ctx.globalAlpha = !anyHovered || isSelected || isHovered ? 1.0 : 0.4;
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
        
        this.ctx.strokeStyle = isSelected || isHovered ? '#e2e8f0' : '#ffffff';
        this.ctx.lineWidth = isSelected || isHovered ? 3 : 1;
        this.ctx.stroke();
    }

    drawLabel(goal, isHovered, anyHovered) {
        // Label handling
        if (anyHovered && !isHovered) return; // Hide other labels if something is hovered

        const innerRadius = parseFloat(goal.startLevel) * this.scale;
        const outerRadius = this.getAdjustedOuterRadius(goal);
        const startAngle = goal.absTheta;
        const endAngle = goal.absTheta + (parseFloat(goal.width) || 0);

        const widthRad = parseFloat(goal.width) || 0;
        if (widthRad > 0.05 || isHovered) {
            const midAngle = (startAngle + endAngle) / 2;
            const midRadius = (innerRadius + outerRadius) / 2;
            const x = this.centerX + Math.cos(midAngle) * midRadius;
            const y = this.centerY + Math.sin(midAngle) * midRadius;

            this.ctx.save();
            this.ctx.translate(x, y);
            
            // Normalize angle to 0 - 2PI for logic
            let normAngle = midAngle;
            while (normAngle < 0) normAngle += Math.PI * 2;
            while (normAngle > Math.PI * 2) normAngle -= Math.PI * 2;

            // Rotate text to be readable
            let rotation = midAngle;
            if (normAngle > Math.PI / 2 && normAngle < (3 * Math.PI) / 2) {
                rotation += Math.PI;
            }
            
            this.ctx.rotate(rotation);
            
            const baseColor = goal.color || '#94a3b8';
            const textColor = this.getContrastColor(baseColor);
            this.ctx.fillStyle = textColor;
            this.ctx.font = isHovered ? 'bold 12px sans-serif' : '10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            let name = goal.name;
            if (!isHovered) {
                // Measure and truncate if needed
                const availableWidth = (outerRadius - innerRadius) * 0.8;
                let metrics = this.ctx.measureText(name);
                if (metrics.width > availableWidth) {
                    while (name.length > 0 && metrics.width > availableWidth - 10) {
                        name = name.substring(0, name.length - 1);
                        metrics = this.ctx.measureText(name + '...');
                    }
                    name += '...';
                }
                
                // Final check: if even '...' is too wide, hide it
                if (this.ctx.measureText('...').width > availableWidth) {
                    name = '';
                }
            }

            this.ctx.fillText(name, 0, 0);
            this.ctx.restore();
        }
    }

    getGoalAt(x, y) {
        if (!this.lastRenderedGoals) return null;

        const dx = x - this.centerX;
        const dy = y - this.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const level = distance / this.scale;
        
        let angle = Math.atan2(dy, dx);
        
        for (const goal of this.lastRenderedGoals) {
            const startLevel = parseFloat(goal.startLevel);
            const endLevel = parseFloat(goal.endLevel);
            
            if (level >= startLevel && level <= endLevel) {
                let goalStart = goal.absTheta;
                let goalEnd = goal.absTheta + parseFloat(goal.width);
                
                // Normalize both to [0, 2PI] for comparison
                const normalize = (a) => {
                    while (a < 0) a += Math.PI * 2;
                    while (a >= Math.PI * 2) a -= Math.PI * 2;
                    return a;
                };

                const normAngle = normalize(angle);
                const normStart = normalize(goalStart);
                const normEnd = normalize(goalEnd);

                if (normStart < normEnd) {
                    if (normAngle >= normStart && normAngle <= normEnd) return goal.id.toString();
                } else {
                    // Spans across the 0/2PI boundary
                    if (normAngle >= normStart || normAngle <= normEnd) return goal.id.toString();
                }
            }
        }
        return null;
    }
}
