export class CLKSunburst extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this.levels = 3;
        this.innerRadius = 50;
        this.outerRadius = 250;
        
        // config is an array of arrays of { id, anchor, color, name }
        // e.g. [ [{id:'c1', anchor:0}, {id:'c2', anchor:0}], [{id:'c3', anchor:0}] ]
        this.data = []; 
        
        this.draggedItem = null; // { id, color, name }

        this.svgNS = "http://www.w3.org/2000/svg";
        
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                }
                svg {
                    width: 100%;
                    height: 100%;
                    user-select: none;
                }
                .arc {
                    stroke: white;
                    stroke-width: 2px;
                    transition: fill-opacity 0.2s;
                }
                .arc:hover {
                    fill-opacity: 0.8;
                }
                .arc-label {
                    font-family: 'Inter', sans-serif;
                    font-size: 10px;
                    font-weight: 500;
                    fill: white;
                    pointer-events: none;
                    text-anchor: middle;
                    dominant-baseline: middle;
                }
                .placeholder-ring {
                    fill: rgba(0,0,0,0.03);
                    stroke: #ddd;
                    stroke-width: 1px;
                    stroke-dasharray: 4;
                }
                .drag-indicator {
                    stroke: var(--brand, #3b82f6);
                    stroke-width: 3px;
                    pointer-events: none;
                }
            </style>
            <svg id="svg"></svg>
        `;

        this.svg = this.shadowRoot.getElementById('svg');
        
        // Drag state variables
        this.isDragging = false;
        this.dragTheta = 0;
        this.dragLayer = -1;
        this.customDragItem = null;
        
        this.svg.addEventListener('dragover', this.handleDragOver.bind(this));
        this.svg.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.svg.addEventListener('drop', this.handleDrop.bind(this));

        this.handleWindowMouseMove = this.handleWindowMouseMove.bind(this);
        this.handleWindowMouseUp = this.handleWindowMouseUp.bind(this);
    }

    connectedCallback() {
        window.addEventListener('mousemove', this.handleWindowMouseMove);
        window.addEventListener('mouseup', this.handleWindowMouseUp);
    }

    disconnectedCallback() {
        window.removeEventListener('mousemove', this.handleWindowMouseMove);
        window.removeEventListener('mouseup', this.handleWindowMouseUp);
    }

    setConfig(levels, innerRadius, outerRadius, data) {
        this.levels = levels;
        this.innerRadius = innerRadius;
        this.outerRadius = outerRadius;
        this.data = data || [];
        this.render();
    }

    setDraggedItem(item) {
        this.draggedItem = item;
    }

    // Convert polar to cartesian coordinates
    polarToCartesian(centerX, centerY, radius, angleInRadians) {
        // Adjust angle so 0 is North (top) and goes clockwise
        const adjustedAngle = angleInRadians - Math.PI / 2;
        return {
            x: centerX + (radius * Math.cos(adjustedAngle)),
            y: centerY + (radius * Math.sin(adjustedAngle))
        };
    }

    // Generate SVG path 'd' attribute for an annular sector
    describeArc(x, y, innerRadius, outerRadius, startAngle, endAngle) {
        // If it's a full circle
        if (Math.abs(endAngle - startAngle) >= 2 * Math.PI - 0.001) {
            // Draw two concentric circles with a small gap
            const outerPath = `M ${x} ${y - outerRadius} A ${outerRadius} ${outerRadius} 0 1 1 ${x} ${y + outerRadius} A ${outerRadius} ${outerRadius} 0 1 1 ${x} ${y - outerRadius}`;
            const innerPath = `M ${x} ${y - innerRadius} A ${innerRadius} ${innerRadius} 0 1 0 ${x} ${y + innerRadius} A ${innerRadius} ${innerRadius} 0 1 0 ${x} ${y - innerRadius}`;
            return outerPath + " " + innerPath;
        }

        const start = this.polarToCartesian(x, y, outerRadius, endAngle);
        const end = this.polarToCartesian(x, y, outerRadius, startAngle);
        const innerStart = this.polarToCartesian(x, y, innerRadius, endAngle);
        const innerEnd = this.polarToCartesian(x, y, innerRadius, startAngle);

        const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";

        return [
            "M", start.x, start.y,
            "A", outerRadius, outerRadius, 0, largeArcFlag, 0, end.x, end.y,
            "L", innerEnd.x, innerEnd.y,
            "A", innerRadius, innerRadius, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
            "Z"
        ].join(" ");
    }

    buildTree() {
        // Build a tree from this.data to compute start/end angles
        // this.data[layerIndex][itemIndex] = { id, anchor, color, name }
        
        const root = { id: 'root', children: [], width: 0, startTheta: 0, endTheta: 2 * Math.PI };
        
        if (this.data.length === 0) return { root, layers: [] };

        // Create nodes
        const layers = [];
        for (let i = 0; i < this.data.length; i++) {
            layers[i] = [];
            for (let j = 0; j < this.data[i].length; j++) {
                layers[i].push({
                    originalData: this.data[i][j],
                    layerIndex: i,
                    itemIndex: j,
                    children: [],
                    width: 0,
                    startTheta: 0,
                    endTheta: 0
                });
            }
        }

        // Link nodes
        for (let i = 0; i < layers.length; i++) {
            for (let j = 0; j < layers[i].length; j++) {
                const node = layers[i][j];
                if (i === 0) {
                    root.children.push(node);
                } else {
                    const anchorIdx = node.originalData.anchor;
                    if (layers[i-1] && layers[i-1][anchorIdx]) {
                        layers[i-1][anchorIdx].children.push(node);
                    } else {
                        // Fallback: append to first element if invalid anchor, or root if empty
                        if (layers[i-1] && layers[i-1].length > 0) {
                            layers[i-1][0].children.push(node);
                        } else {
                            root.children.push(node);
                        }
                    }
                }
            }
        }

        // Identify leaves and assign base widths (1 unit per leaf)
        let totalLeaves = 0;
        const traverseLeaves = (node) => {
            if (node.children.length === 0) {
                node.width = 1;
                if (node.id !== 'root') totalLeaves++;
            } else {
                let sum = 0;
                for (const child of node.children) {
                    traverseLeaves(child);
                    sum += child.width;
                }
                node.width = sum;
            }
        };
        
        traverseLeaves(root);
        
        if (totalLeaves === 0 && root.children.length > 0) {
            // Handle edge case where there are no leaves? Shouldn't happen.
            totalLeaves = root.children.length;
        }

        // Total width of the tree is the width of root.
        // Assign angles.
        const widthToRadians = totalLeaves > 0 ? (2 * Math.PI) / root.width : 0;
        
        const assignAngles = (node, startTheta) => {
            node.startTheta = startTheta;
            node.endTheta = startTheta + (node.width * widthToRadians);
            
            let currentTheta = startTheta;
            for (const child of node.children) {
                assignAngles(child, currentTheta);
                currentTheta += (child.width * widthToRadians);
            }
        };

        assignAngles(root, 0);

        return { root, layers };
    }

    render() {
        this.svg.innerHTML = '';
        const rect = this.getBoundingClientRect();
        
        // If not attached yet or zero size, don't try to calculate centers
        let width = rect.width;
        let height = rect.height;
        if (width === 0 || height === 0) {
            width = this.outerRadius * 2.2;
            height = this.outerRadius * 2.2;
        }
        
        const cx = width / 2;
        const cy = height / 2;

        const maxOuterRadius = Math.min(cx, cy) * 0.95;
        let effectiveOuterRadius = this.outerRadius;
        
        // Scale down if it doesn't fit
        const scale = this.outerRadius > maxOuterRadius ? maxOuterRadius / this.outerRadius : 1;
        const rOuter = this.outerRadius * scale;
        const rInner = this.innerRadius * scale;
        
        // Ensure we have at least 'this.levels' layers visible, even if empty
        const numLayers = Math.max(this.levels, this.data.length);
        const layerWidth = numLayers > 0 ? (rOuter - rInner) / numLayers : 0;

        // Draw empty placeholder rings for levels
        for (let i = 0; i < numLayers; i++) {
            const currentInner = rInner + i * layerWidth;
            const currentOuter = rInner + (i + 1) * layerWidth;
            
            const ring = document.createElementNS(this.svgNS, 'path');
            ring.setAttribute('class', 'placeholder-ring');
            ring.setAttribute('d', this.describeArc(cx, cy, currentInner, currentOuter, 0, 2*Math.PI));
            this.svg.appendChild(ring);
        }

        const { layers } = this.buildTree();
        this.computedLayers = layers; // Save for drag and drop logic
        this.renderContext = { cx, cy, rInner, layerWidth };

        // Draw populated elements
        if (layers) {
            for (let i = 0; i < layers.length; i++) {
                const currentInner = rInner + i * layerWidth;
                const currentOuter = rInner + (i + 1) * layerWidth;

                for (let j = 0; j < layers[i].length; j++) {
                    const node = layers[i][j];
                    const path = document.createElementNS(this.svgNS, 'path');
                    path.setAttribute('class', 'arc');
                    path.setAttribute('d', this.describeArc(cx, cy, currentInner, currentOuter, node.startTheta, node.endTheta));
                    path.setAttribute('fill', node.originalData.color || '#94a3b8');
                    
                    path.style.cursor = 'grab';
                    path.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        this.customDragItem = { id: node.originalData.id, name: node.originalData.name, color: node.originalData.color };
                        this.setDraggedItem(this.customDragItem);
                        path.style.opacity = '0.5';
                        e.stopPropagation();
                    });

                    // Add Title for hover tooltip
                    const title = document.createElementNS(this.svgNS, 'title');
                    title.textContent = node.originalData.name;
                    path.appendChild(title);
                    
                    this.svg.appendChild(path);

                    // Add text label if the arc is wide enough
                    const arcAngle = node.endTheta - node.startTheta;
                    if (arcAngle > 0.1) {
                        const midTheta = (node.startTheta + node.endTheta) / 2;
                        const midRadius = (currentInner + currentOuter) / 2;
                        const textPos = this.polarToCartesian(cx, cy, midRadius, midTheta);
                        
                        const text = document.createElementNS(this.svgNS, 'text');
                        text.setAttribute('class', 'arc-label');
                        text.setAttribute('x', textPos.x);
                        text.setAttribute('y', textPos.y);
                        
                        // Rotate text to match arc
                        let rotateAngle = (midTheta * 180 / Math.PI) - 90;
                        if (rotateAngle > 90 || rotateAngle < -90) {
                            rotateAngle += 180;
                        }
                        text.setAttribute('transform', `rotate(${rotateAngle}, ${textPos.x}, ${textPos.y})`);
                        
                        let shortName = node.originalData.name;
                        if (shortName.length > 15) shortName = shortName.substring(0, 12) + '...';
                        text.textContent = shortName;
                        
                        this.svg.appendChild(text);
                    }
                }
            }
        }
    }

    updateDragIndicator() {
        // Remove existing indicator if any
        let line = this.svg.querySelector('.drag-indicator');
        if (line) {
            line.remove();
        }

        if (this.isDragging && this.renderContext) {
            const numLayers = Math.max(this.levels, this.data.length);
            if (this.dragLayer >= 0 && this.dragLayer < numLayers) {
                const { cx, cy, rInner, layerWidth } = this.renderContext;
                const currentInner = rInner + this.dragLayer * layerWidth;
                const currentOuter = rInner + (this.dragLayer + 1) * layerWidth;
                
                const lineStart = this.polarToCartesian(cx, cy, currentInner, this.dragTheta);
                const lineEnd = this.polarToCartesian(cx, cy, currentOuter, this.dragTheta);
                
                line = document.createElementNS(this.svgNS, 'line');
                line.setAttribute('class', 'drag-indicator');
                line.setAttribute('x1', lineStart.x);
                line.setAttribute('y1', lineStart.y);
                line.setAttribute('x2', lineEnd.x);
                line.setAttribute('y2', lineEnd.y);
                this.svg.appendChild(line);
            }
        }
    }

    getPolarFromMouse(e) {
        if (!this.renderContext) return null;
        
        const rect = this.svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const { cx, cy, rInner, layerWidth } = this.renderContext;
        
        const dx = x - cx;
        const dy = y - cy;
        
        const radius = Math.sqrt(dx*dx + dy*dy);
        let theta = Math.atan2(dy, dx) + Math.PI / 2; // adjust so North is 0
        if (theta < 0) theta += 2 * Math.PI;
        if (theta >= 2 * Math.PI) theta -= 2 * Math.PI;
        
        // Calculate layer based on radius
        let layer = -1;
        const numLayers = Math.max(this.levels, this.data.length);
        
        if (radius < rInner) {
            layer = 0;
        } else if (radius > rInner + numLayers * layerWidth) {
            layer = numLayers - 1;
        } else {
            layer = Math.floor((radius - rInner) / layerWidth);
        }
        
        return { radius, theta, layer };
    }

    handleDragOver(e) {
        e.preventDefault(); // Necessary to allow dropping
        if (!this.draggedItem) return;

        const polar = this.getPolarFromMouse(e);
        if (polar) {
            this.isDragging = true;
            this.dragLayer = polar.layer;
            this.dragTheta = polar.theta;
            this.updateDragIndicator();
        }
    }

    handleDragLeave(e) {
        this.isDragging = false;
        this.updateDragIndicator();
    }

    handleDrop(e) {
        e.preventDefault();
        this.isDragging = false;
        this.updateDragIndicator();
        
        if (!this.draggedItem) {
            return;
        }

        const polar = this.getPolarFromMouse(e);
        if (polar) {
            this.processDrop(polar, this.draggedItem);
        }
    }

    handleWindowMouseMove(e) {
        if (!this.customDragItem) return;
        
        const polar = this.getPolarFromMouse(e);
        if (polar) {
            this.isDragging = true;
            this.dragLayer = polar.layer;
            this.dragTheta = polar.theta;
            this.updateDragIndicator();
        }
    }

    handleWindowMouseUp(e) {
        if (!this.customDragItem) return;
        
        const polar = this.getPolarFromMouse(e);
        this.isDragging = false;
        this.updateDragIndicator();
        
        const rect = this.svg.getBoundingClientRect();
        const isInside = (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom);
        
        if (isInside && polar) {
            this.processDrop(polar, this.customDragItem);
        } else {
            this.dispatchEvent(new CustomEvent('sunburst-remove', {
                detail: { id: this.customDragItem.id }
            }));
        }
        
        this.customDragItem = null;
        this.setDraggedItem(null);
        this.render();
    }

    processDrop(polar, item) {
        const numLayers = Math.max(this.levels, this.data.length);
        if (polar.layer >= 0 && polar.layer < numLayers) {
            const targetLayer = polar.layer;
            const targetTheta = polar.theta;
            
            let anchorIndex = 0;
            let insertIndex = 0;

            if (targetLayer > 0) {
                const parentLayerNodes = this.computedLayers[targetLayer - 1] || [];
                if (parentLayerNodes.length > 0) {
                    let parentFound = false;
                    for (let i = 0; i < parentLayerNodes.length; i++) {
                        const pNode = parentLayerNodes[i];
                        if (targetTheta >= pNode.startTheta && targetTheta <= pNode.endTheta) {
                            anchorIndex = i;
                            parentFound = true;
                            break;
                        }
                    }
                    if (!parentFound) {
                        anchorIndex = 0;
                    }
                }
            }

            const currentNodes = this.computedLayers[targetLayer] || [];
            const peers = currentNodes.filter(n => (targetLayer === 0) || (n.originalData.anchor === anchorIndex));
            
            if (peers.length === 0) {
                insertIndex = currentNodes.length;
            } else {
                let absoluteInsertIndex = peers[peers.length - 1].itemIndex + 1;
                for (let i = 0; i < peers.length; i++) {
                    const peer = peers[i];
                    const midTheta = (peer.startTheta + peer.endTheta) / 2;
                    if (targetTheta < midTheta) {
                        absoluteInsertIndex = peer.itemIndex;
                        break;
                    }
                }
                insertIndex = absoluteInsertIndex;
            }

            this.dispatchEvent(new CustomEvent('sunburst-drop', {
                detail: {
                    item: item,
                    layer: targetLayer,
                    anchor: anchorIndex,
                    insertIndex: insertIndex
                }
            }));
        }
        this.render();
    }
}

customElements.define('clk-sunburst', CLKSunburst);
