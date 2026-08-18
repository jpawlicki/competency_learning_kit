import { createElement, setElementContents } from './utils.js';
export function initSetupReports(AppState, storage) {
    const listEl = document.getElementById('report_templates_list');
    const btnAdd = document.getElementById('add_report_template_btn');
    const editorEl = document.getElementById('report_template_editor');
    const titleEl = document.getElementById('report_template_title');
    const inputName = document.getElementById('rt_name');
    const inputLevels = document.getElementById('rt_levels');
    const inputInner = document.getElementById('rt_inner_radius');
    const inputOuter = document.getElementById('rt_outer_radius');
    const compSelectorEl = document.getElementById('rt_competency_selector');
    const sunburstEl = document.getElementById('rt_sunburst_preview');
    const btnCancel = document.getElementById('cancel_rt_btn');
    const btnSave = document.getElementById('save_rt_btn');

    let allCompetencies = [];
    let compGroups = [];
    let reportTemplates = [];
    let currentTemplateId = null;
    let currentData = []; // The parsed config array

    async function loadData() {
        const data = await AppState.load();
        if (!data) return;

        allCompetencies = data['Competency'] || [];
        compGroups = data['Competency Group'] || [];
        reportTemplates = data['Radial Report Template'] || [];

        renderList();
    }

    // Call loadData immediately to initialize the UI state
    loadData();

    // Also re-load when data invalidates (e.g., auth changes)
    // We can expose a refresh method if needed, but for now we just observe

    function renderList() {
        setElementContents(listEl);
        if (reportTemplates.length === 0) {
            setElementContents(listEl, createElement('li', { className: 'placeholder-text', textContent: 'No templates found.' }));
            return;
        }

        reportTemplates.forEach(t => {
            const li = document.createElement('li');
            li.className = 'group-list-item' + (currentTemplateId === t.id ? ' selected' : '');

            const span = document.createElement('span');
            span.textContent = t.name;
            li.appendChild(span);

            const editBtn = document.createElement('button');
            editBtn.className = 'material-symbols-outlined btn-icon';
            editBtn.textContent = 'edit';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                openEditor(t);
            };
            li.appendChild(editBtn);

            li.onclick = () => openEditor(t);
            listEl.appendChild(li);
        });
    }

    function parseConfig(configStr) {
        if (!configStr) return [];
        const layers = configStr.split(';');
        return layers.map(layerStr => {
            if (!layerStr) return [];
            return layerStr.split(':').map(pair => {
                const parts = pair.split('#');
                const id = parts[0];
                const anchorParts = parts[1] ? parts[1].split('-') : ['0'];
                return {
                    id,
                    anchor: parseInt(anchorParts[0], 10) || 0,
                    span: parseInt(anchorParts[1], 10) || 1
                };
            });
        });
    }

    function serializeConfig(dataArr) {
        return dataArr.map(layer => {
            return layer.map(item => {
                if (item.span && item.span > 1) {
                    return `${item.id}#${item.anchor}-${item.span}`;
                }
                return `${item.id}#${item.anchor}`;
            }).join(':');
        }).join(';');
    }

    function enrichData(dataArr) {
        return dataArr.map(layer => {
            return layer.map(item => {
                const comp = allCompetencies.find(c => c.id === item.id) || { name: 'Unknown', color: '#999' };
                return {
                    ...item,
                    name: comp.name,
                    color: comp.color
                };
            });
        });
    }

    function openEditor(template = null) {
        editorEl.classList.remove('hidden');
        if (template) {
            currentTemplateId = template.id;
            titleEl.textContent = 'Edit Template';
            inputName.value = template.name;
            inputInner.value = template.innerRadius;
            inputOuter.value = template.outerRadius;
            currentData = parseConfig(template.config);
            inputLevels.value = Math.max(3, currentData.length);
        } else {
            currentTemplateId = null;
            titleEl.textContent = 'New Template';
            inputName.value = '';
            inputInner.value = 100;
            inputOuter.value = 500;
            inputLevels.value = 4;
            currentData = [];
        }

        renderEditor();
        renderList(); // Update selected state
    }

    function closeEditor() {
        editorEl.classList.add('hidden');
        currentTemplateId = null;
        renderList();
    }

    function renderEditor() {
        renderCompetencySelector();
        updateSunburst();
    }

    function isCompetencyInConfig(compId) {
        for (const layer of currentData) {
            for (const item of layer) {
                if (item.id === compId) return true;
            }
        }
        return false;
    }

    function renderCompetencySelector() {
        setElementContents(compSelectorEl);

        // Render ungrouped competencies first
        const ungrouped = allCompetencies.filter(c => !compGroups.some(g => g.competencyIds.includes(c.id)));
        if (ungrouped.length > 0) {
            renderCompetencyGroup('Ungrouped', ungrouped);
        }

        // Render grouped competencies
        compGroups.forEach(g => {
            const compsInGroup = allCompetencies.filter(c => g.competencyIds.includes(c.id));
            if (compsInGroup.length > 0) {
                renderCompetencyGroup(g.name, compsInGroup);
            }
        });
    }

    function renderCompetencyGroup(groupName, competencies) {
        const groupDiv = document.createElement('div');
        groupDiv.style.marginBottom = '0.5rem';

        const groupTitle = document.createElement('div');
        groupTitle.textContent = groupName;
        groupTitle.style.fontWeight = 'bold';
        groupTitle.style.fontSize = '0.85rem';
        groupTitle.style.color = 'var(--text-muted)';
        groupTitle.style.borderBottom = '1px solid var(--border)';
        groupTitle.style.marginBottom = '0.25rem';
        groupTitle.style.paddingBottom = '0.1rem';
        groupDiv.appendChild(groupTitle);

        competencies.forEach(c => {
            const compDiv = document.createElement('div');
            compDiv.style.display = 'flex';
            compDiv.style.alignItems = 'center';
            compDiv.style.gap = '0.5rem';
            compDiv.style.padding = '0.25rem';
            compDiv.style.border = '1px solid transparent';
            compDiv.style.borderRadius = '4px';

            const inConfig = isCompetencyInConfig(c.id);

            const label = document.createElement('span');
            label.textContent = c.name;
            label.style.fontSize = '0.85rem';
            label.style.flex = '1';

            if (inConfig) {
                compDiv.style.opacity = '0.4';
                compDiv.style.cursor = 'default';
                // Not draggable if already in sunburst
            } else {
                compDiv.style.opacity = '1';
                compDiv.style.cursor = 'grab';
                compDiv.draggable = true;
                compDiv.addEventListener('dragstart', (e) => {
                    sunburstEl.setDraggedItem({ id: c.id, name: c.name, color: c.color });
                    e.dataTransfer.setData('text/plain', c.id);
                    compDiv.style.opacity = '0.5';
                });
                compDiv.addEventListener('dragend', (e) => {
                    sunburstEl.setDraggedItem(null);
                    compDiv.style.opacity = '1';
                    sunburstEl.handleDragLeave(e);
                });
            }

            compDiv.appendChild(label);
            groupDiv.appendChild(compDiv);
        });

        compSelectorEl.appendChild(groupDiv);
    }

    function removeCompetencyFromConfig(compId) {
        let removedInfo = null;
        for (let i = 0; i < currentData.length; i++) {
            const layer = currentData[i];
            const idx = layer.findIndex(item => item.id === compId);
            if (idx !== -1) {
                removedInfo = { layer: i, index: idx };
                layer.splice(idx, 1);

                if (i + 1 < currentData.length) {
                    const nextLayer = currentData[i + 1];
                    for (let j = 0; j < nextLayer.length; j++) {
                        if (nextLayer[j].anchor === idx) {
                            nextLayer[j].anchor = Math.max(0, idx - 1);
                        } else if (nextLayer[j].anchor > idx) {
                            nextLayer[j].anchor--;
                        }
                    }
                }
                break;
            }
        }

        while (currentData.length > 0 && currentData[currentData.length - 1].length === 0) {
            currentData.pop();
        }

        updateSunburst();
        renderCompetencySelector();
        return removedInfo;
    }

    function sanitizeData(data) {
        for (let i = 1; i < data.length; i++) {
            const layer = data[i];
            const mapped = layer.map((item, originalIndex) => ({ item, originalIndex }));
            mapped.sort((a, b) => {
                if (a.item.anchor !== b.item.anchor) {
                    return a.item.anchor - b.item.anchor;
                }
                return a.originalIndex - b.originalIndex;
            });
            const oldToNew = {};
            for (let newIndex = 0; newIndex < mapped.length; newIndex++) {
                oldToNew[mapped[newIndex].originalIndex] = newIndex;
                layer[newIndex] = mapped[newIndex].item;
            }
            if (i + 1 < data.length) {
                const nextLayer = data[i + 1];
                for (const nextItem of nextLayer) {
                    if (nextItem.anchor !== undefined && nextItem.anchor in oldToNew) {
                        nextItem.anchor = oldToNew[nextItem.anchor];
                    }
                }
            }
        }
    }

    function updateSunburst() {
        const levels = parseInt(inputLevels.value, 10) || 4;
        const inner = parseFloat(inputInner.value) || 100;
        const outer = parseFloat(inputOuter.value) || 500;
        sanitizeData(currentData);
        const enriched = enrichData(currentData);
        sunburstEl.setConfig(levels, inner, outer, enriched);
    }

    inputLevels.addEventListener('input', updateSunburst);
    inputInner.addEventListener('input', updateSunburst);
    inputOuter.addEventListener('input', updateSunburst);

    sunburstEl.addEventListener('sunburst-drop', (e) => {
        let { item, layer, anchor, insertIndex } = e.detail;

        const removedInfo = removeCompetencyFromConfig(item.id);

        if (removedInfo && removedInfo.layer === layer && removedInfo.index < insertIndex) {
            insertIndex--;
        }

        while (currentData.length <= layer) {
            currentData.push([]);
        }

        currentData[layer].splice(insertIndex, 0, { id: item.id, anchor: anchor, span: 1 });

        // 3. Fix anchors for the layer that was just inserted into!
        // We inserted an element at insertIndex.
        // Any anchor in layer+1 that was >= insertIndex must be incremented.
        if (layer + 1 < currentData.length) {
            const nextLayer = currentData[layer + 1];
            for (let j = 0; j < nextLayer.length; j++) {
                if (nextLayer[j].anchor >= insertIndex) {
                    nextLayer[j].anchor++;
                }
            }
        }

        updateSunburst();
        renderCompetencySelector(); // Update styles
    });

    sunburstEl.addEventListener('sunburst-remove', (e) => {
        removeCompetencyFromConfig(e.detail.id);
    });

    sunburstEl.addEventListener('sunburst-resize', (e) => {
        const { id, layer, anchor, span } = e.detail;
        if (layer >= 0 && layer < currentData.length) {
            const itemIdx = currentData[layer].findIndex(i => i.id === id);
            if (itemIdx !== -1) {
                const item = currentData[layer][itemIdx];
                item.anchor = anchor;
                item.span = span;

                updateSunburst();
            }
        }
    });

    btnAdd.addEventListener('click', () => openEditor(null));
    btnCancel.addEventListener('click', closeEditor);

    btnSave.addEventListener('click', async () => {
        const name = inputName.value.trim();
        if (!name) {
            alert('Template name is required.');
            return;
        }

        btnSave.disabled = true;
        btnSave.textContent = 'Saving...';

        try {
            const id = currentTemplateId || 'rt_' + Date.now();
            const configStr = serializeConfig(currentData);
            const template = {
                id,
                name,
                config: configStr,
                innerRadius: parseFloat(inputInner.value) || 50,
                outerRadius: parseFloat(inputOuter.value) || 250
            };

            if (currentTemplateId) {
                const idx = reportTemplates.findIndex(t => t.id === currentTemplateId);
                if (idx !== -1) reportTemplates[idx] = template;
            } else {
                reportTemplates.push(template);
            }

            await storage.saveReportTemplates(reportTemplates);
            AppState.invalidate();
            await AppState.load();
            closeEditor();
        } catch (e) {
            alert('Error saving template: ' + e.message);
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = 'Save Template';
        }
    });
}
