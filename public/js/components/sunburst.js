import { setElementContents } from '../utils.js';
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
        this.mode = 'edit';
        
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
                    pointer-events: none;
                    text-anchor: middle;
                    dominant-baseline: middle;
                }
                .placeholder-ring {
                    fill: rgba(0,0,0,0.015);
                    stroke: #eee;
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
        this.selectedItemId = null;
        this.isDraggingHandle = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        
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

    setMode(mode) {
        this.mode = mode;
        this.render();
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

    getContrastColor(hexColor) {
        if (!hexColor) return '#000000';
        hexColor = hexColor.replace('#', '');
        if (hexColor.length === 3) {
            hexColor = hexColor.split('').map(c => c + c).join('');
        }
        const r = parseInt(hexColor.substr(0, 2), 16) || 0;
        const g = parseInt(hexColor.substr(2, 2), 16) || 0;
        const b = parseInt(hexColor.substr(4, 2), 16) || 0;
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 80) ? '#000000' : '#ffffff';
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
        // this.data[layerIndex][itemIndex] = { id, anchor, span, color, name }
        
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
                    parents: [],
                    children: [],
                    weight: 0,
                    startTheta: 0,
                    endTheta: 0,
                    slots: []
                });
            }
        }

        // Link nodes
        for (let i = 1; i < layers.length; i++) {
            for (let j = 0; j < layers[i].length; j++) {
                const node = layers[i][j];
                const anchorIdx = node.originalData.anchor || 0;
                const span = node.originalData.span || 1;
                
                for (let s = 0; s < span; s++) {
                    const pIdx = anchorIdx + s;
                    if (layers[i-1] && layers[i-1][pIdx]) {
                        const pNode = layers[i-1][pIdx];
                        pNode.children.push(node);
                        node.parents.push(pNode);
                    }
                }
            }
        }

        // Compute weights bottom-up
        for (let i = layers.length - 1; i >= 0; i--) {
            for (let j = 0; j < layers[i].length; j++) {
                const node = layers[i][j];
                if (node.children.length === 0) {
                    node.weight = 1;
                } else {
                    node.weight = 0;
                    for (const child of node.children) {
                        node.weight += child.weight / child.parents.length;
                    }
                }
            }
        }

        // Assign angles top-down
        if (layers.length > 0 && layers[0].length > 0) {
            let currentStart = 0;
            const totalLayer0Weight = layers[0].reduce((sum, n) => sum + n.weight, 0);
            
            for (const node of layers[0]) {
                const angle = totalLayer0Weight > 0 ? (node.weight / totalLayer0Weight) * (Math.PI * 2) : 0;
                node.startTheta = currentStart;
                node.endTheta = currentStart + angle;
                currentStart = node.endTheta;
            }

            for (let i = 1; i < layers.length; i++) {
                // Pass down slots from parents
                for (const pNode of layers[i-1]) {
                    let pStart = pNode.startTheta;
                    for (const child of pNode.children) {
                        const childShareWeight = child.weight / child.parents.length;
                        const shareRatio = pNode.weight > 0 ? (childShareWeight / pNode.weight) : 0;
                        const slotAngle = shareRatio * (pNode.endTheta - pNode.startTheta);
                        
                        child.slots.push({
                            parent: pNode,
                            startTheta: pStart,
                            endTheta: pStart + slotAngle
                        });
                        
                        pStart += slotAngle;
                    }
                }
                
                // Construct child arcs from slots
                for (const node of layers[i]) {
                    if (node.slots && node.slots.length > 0) {
                        node.startTheta = node.slots[0].startTheta;
                        node.endTheta = node.slots[node.slots.length - 1].endTheta;
                    }
                }
            }
        }

        // Deep copy for logging so the browser console doesn't show mutated state
        console.log('sunburst buildTree result', JSON.parse(JSON.stringify(
            layers.map(layer => layer.map(n => ({
                id: n.originalData.id,
                anchor: n.originalData.anchor,
                span: n.originalData.span,
                weight: n.weight,
                startTheta: n.startTheta,
                endTheta: n.endTheta,
                parents: n.parents.map(p => p.originalData.id),
                slots: n.slots.map(s => ({ start: s.startTheta, end: s.endTheta }))
            })))
        )));

        return { root, layers };
    }

    render() {
        setElementContents(this.svg);
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
                    if (this.mode === 'report') {
                        const score = node.originalData.score;
                        if (score === undefined || score === null) {
                            continue; // "Not Assessed" -> render nothing
                        }

                        // Draw 5% background arc
                        const bgPath = document.createElementNS(this.svgNS, 'path');
                        bgPath.setAttribute('class', 'arc');
                        bgPath.setAttribute('d', this.describeArc(cx, cy, currentInner, currentOuter, node.startTheta, node.endTheta));
                        bgPath.setAttribute('fill', node.originalData.color || '#94a3b8');
                        bgPath.style.fillOpacity = '0.05';
                        this.svg.appendChild(bgPath);

                        // Draw progress arc if score > 0
                        if (score > 0) {
                            const progressOuter = currentInner + (currentOuter - currentInner) * score;
                            const path = document.createElementNS(this.svgNS, 'path');
                            path.setAttribute('class', 'arc');
                            path.setAttribute('d', this.describeArc(cx, cy, currentInner, progressOuter, node.startTheta, node.endTheta));
                            path.setAttribute('fill', node.originalData.color || '#94a3b8');
                            
                            const title = document.createElementNS(this.svgNS, 'title');
                            title.textContent = `${node.originalData.name} (${Math.round(score * 100)}%)`;
                            path.appendChild(title);
                            
                            this.svg.appendChild(path);
                        }
                    } else {
                        const path = document.createElementNS(this.svgNS, 'path');
                        path.setAttribute('class', 'arc');
                        path.setAttribute('d', this.describeArc(cx, cy, currentInner, currentOuter, node.startTheta, node.endTheta));
                        path.setAttribute('fill', node.originalData.color || '#94a3b8');
                        
                        path.style.cursor = 'grab';
                        path.addEventListener('mousedown', (e) => {
                            e.preventDefault();
                            this.selectedItemId = node.originalData.id;
                            this.customDragItem = { id: node.originalData.id, name: node.originalData.name, color: node.originalData.color };
                            this.setDraggedItem(this.customDragItem);
                            this.dragStartX = e.clientX;
                            this.dragStartY = e.clientY;
                            path.style.opacity = '0.5';
                            e.stopPropagation();
                            this.render(); // Redraw with selection
                        });

                        // Add Title for hover tooltip
                        const title = document.createElementNS(this.svgNS, 'title');
                        title.textContent = node.originalData.name;
                        path.appendChild(title);
                        
                        this.svg.appendChild(path);
                    }

                    // Add text label if the arc is wide enough
                    const arcAngle = node.endTheta - node.startTheta;
                    if (arcAngle > 0.1) {
                        const midTheta = (node.startTheta + node.endTheta) / 2;
                        const midRadius = (currentInner + currentOuter) / 2;
                        
                        const arcLength = arcAngle * midRadius;
                        
                        let shortName = node.originalData.name;
                        if (shortName.length > 18) shortName = shortName.substring(0, 15) + '...';

                        const bgColor = node.originalData.color || '#94a3b8';
                        const textColor = this.getContrastColor(bgColor);

                        const text = document.createElementNS(this.svgNS, 'text');
                        text.setAttribute('class', 'arc-label');
                        text.setAttribute('fill', textColor);

                        if (arcLength > layerWidth) {
                            // Draw curved text along the arcline
                            const pathId = `textpath_${node.layerIndex}_${node.itemIndex}_${Math.random().toString(36).substr(2, 9)}`;
                            
                            let start = node.startTheta;
                            let end = node.endTheta;
                            let sweepFlag = 1;

                            // If text would be upside down, draw path in reverse
                            let isUpsideDown = (midTheta > Math.PI / 2 && midTheta < 3 * Math.PI / 2);
                            if (isUpsideDown) {
                                start = node.endTheta;
                                end = node.startTheta;
                                sweepFlag = 0;
                            }

                            const pStart = this.polarToCartesian(cx, cy, midRadius, start);
                            const pEnd = this.polarToCartesian(cx, cy, midRadius, end);
                            const largeArcFlag = arcAngle <= Math.PI ? "0" : "1";

                            const pathData = `M ${pStart.x} ${pStart.y} A ${midRadius} ${midRadius} 0 ${largeArcFlag} ${sweepFlag} ${pEnd.x} ${pEnd.y}`;

                            let defs = this.svg.querySelector('defs');
                            if (!defs) {
                                defs = document.createElementNS(this.svgNS, 'defs');
                                this.svg.appendChild(defs);
                            }

                            const path = document.createElementNS(this.svgNS, 'path');
                            path.setAttribute('id', pathId);
                            path.setAttribute('d', pathData);
                            defs.appendChild(path);

                            const textPath = document.createElementNS(this.svgNS, 'textPath');
                            textPath.setAttribute('href', `#${pathId}`);
                            textPath.setAttribute('startOffset', '50%');
                            textPath.textContent = shortName;

                            text.appendChild(textPath);
                            this.svg.appendChild(text);
                        } else {
                            const textPos = this.polarToCartesian(cx, cy, midRadius, midTheta);
                            text.setAttribute('x', textPos.x);
                            text.setAttribute('y', textPos.y);
                            
                            // Rotate text to match arc
                            let rotateAngle = (midTheta * 180 / Math.PI) - 90;
                            if (rotateAngle > 90 || rotateAngle < -90) {
                                rotateAngle += 180;
                            }
                            text.setAttribute('transform', `rotate(${rotateAngle}, ${textPos.x}, ${textPos.y})`);
                            text.textContent = shortName;
                            
                            this.svg.appendChild(text);
                        }
                    }
                }
            }
        }

        if (this.mode !== 'report') {
            this.updateSelection();
        }
    }

    drawHandle(cx, cy, radius, theta, node, type) {
        const pos = this.polarToCartesian(cx, cy, radius, theta);
        const handle = document.createElementNS(this.svgNS, 'circle');
        handle.setAttribute('class', 'drag-handle');
        handle.setAttribute('cx', pos.x);
        handle.setAttribute('cy', pos.y);
        handle.setAttribute('r', '6');
        handle.setAttribute('fill', '#fff');
        handle.setAttribute('stroke', '#3b82f6');
        handle.setAttribute('stroke-width', '2');
        handle.style.cursor = 'crosshair';
        
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isDraggingHandle = { node, type };
        });
        
        this.svg.appendChild(handle);
    }

    updateSelection() {
        const oldHandles = this.svg.querySelectorAll('.drag-handle, .selection-stroke');
        oldHandles.forEach(h => h.remove());

        if (!this.selectedItemId) return;

        let selectedNode = null;
        if (this.computedLayers) {
            for (const layer of this.computedLayers) {
                for (const node of layer) {
                    if (node.originalData.id === this.selectedItemId) {
                        selectedNode = node;
                        break;
                    }
                }
            }
        }
        
        if (!selectedNode || !this.renderContext) return;

        const { cx, cy, rInner, layerWidth } = this.renderContext;
        const currentInner = rInner + selectedNode.layerIndex * layerWidth;
        const currentOuter = rInner + (selectedNode.layerIndex + 1) * layerWidth;
        const midRadius = (currentInner + currentOuter) / 2;
        
        const stroke = document.createElementNS(this.svgNS, 'path');
        stroke.setAttribute('class', 'selection-stroke');
        stroke.setAttribute('d', this.describeArc(cx, cy, currentInner, currentOuter, selectedNode.startTheta, selectedNode.endTheta));
        stroke.setAttribute('fill', 'none');
        stroke.setAttribute('stroke', '#3b82f6');
        stroke.setAttribute('stroke-width', '3');
        stroke.style.pointerEvents = 'none';
        this.svg.appendChild(stroke);

        if (selectedNode.layerIndex > 0) {
            this.drawHandle(cx, cy, midRadius, selectedNode.startTheta, selectedNode, 'left');
            this.drawHandle(cx, cy, midRadius, selectedNode.endTheta, selectedNode, 'right');
            
            if (this.isDraggingHandle && this.isDraggingHandle.node.originalData.id === selectedNode.originalData.id) {
                this.isDraggingHandle.node = selectedNode;
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
        if (this.mode === 'report') return;
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

    handleDragLeave() {
        if (this.mode === 'report') return;
        this.isDragging = false;
        this.updateDragIndicator();
    }

    handleDrop(e) {
        if (this.mode === 'report') return;
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
        if (this.mode === 'report') return;
        if (this.isDraggingHandle) {
            const polar = this.getPolarFromMouse(e);
            if (polar) {
                this.updateHandleDrag(polar.theta);
            }
            return;
        }

        if (!this.customDragItem) return;
        
        if (!this.isDragging) {
            if (Math.abs(e.clientX - this.dragStartX) > 5 || Math.abs(e.clientY - this.dragStartY) > 5) {
                this.isDragging = true;
            } else {
                return;
            }
        }
        
        const polar = this.getPolarFromMouse(e);
        if (polar) {
            this.dragLayer = polar.layer;
            this.dragTheta = polar.theta;
            this.updateDragIndicator();
        }
    }

    handleWindowMouseUp(e) {
        if (this.mode === 'report') return;
        if (this.isDraggingHandle) {
            this.isDraggingHandle = null;
            return;
        }

        if (!this.customDragItem) return;
        
        const wasDragging = this.isDragging;
        
        const polar = this.getPolarFromMouse(e);
        this.isDragging = false;
        this.updateDragIndicator();
        
        if (!wasDragging) {
            // Just a click to select, do not trigger a drop
            this.customDragItem = null;
            this.setDraggedItem(null);
            return;
        }
        
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

    updateHandleDrag(mouseTheta) {
        const { node, type } = this.isDraggingHandle;
        
        const parentLayer = this.computedLayers[node.layerIndex - 1];
        if (!parentLayer || parentLayer.length === 0) return;
        
        let targetParentIdx = -1;
        for (let i = 0; i < parentLayer.length; i++) {
            const pNode = parentLayer[i];
            if (mouseTheta >= pNode.startTheta && mouseTheta <= pNode.endTheta) {
                targetParentIdx = i;
                break;
            }
        }
        
        if (targetParentIdx !== -1) {
            const currentAnchor = node.originalData.anchor || 0;
            const currentSpan = node.originalData.span || 1;
            const endParentIdx = currentAnchor + currentSpan - 1;
            
            let newAnchor = currentAnchor;
            let newSpan = currentSpan;
            
            if (type === 'left') {
                if (targetParentIdx <= endParentIdx) {
                    newAnchor = targetParentIdx;
                    newSpan = endParentIdx - targetParentIdx + 1;
                }
            } else if (type === 'right') {
                if (targetParentIdx >= currentAnchor) {
                    newSpan = targetParentIdx - currentAnchor + 1;
                }
            }
            
            if (newAnchor !== currentAnchor || newSpan !== currentSpan) {
                // Update local data immediately to prevent jitter before re-render
                node.originalData.anchor = newAnchor;
                node.originalData.span = newSpan;
                
                this.dispatchEvent(new CustomEvent('sunburst-resize', {
                    detail: {
                        id: node.originalData.id,
                        layer: node.layerIndex,
                        anchor: newAnchor,
                        span: newSpan
                    }
                }));
            }
        }
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
