export function initReportsView(AppState, storage) {
    const viewReports = document.getElementById('view-reports');
    const learnerListEl = document.getElementById('report_learner_list');
    const compGroupListEl = document.getElementById('report_comp_group_list');
    const contentArea = document.getElementById('report_content_area');

    // Rating Config for Summative Assessments
    const summativeRatings = [
        { val: 0.0, label: 'Never/Rarely', title: 'Never/Rarely Demonstrates', color: '#ef4444' },
        { val: 0.5, label: 'Sometimes', title: 'Sometimes Demonstrates', color: '#f59e0b' },
        { val: 1.0, label: 'Reliably', title: 'Reliably Demonstrates', color: '#10b981' }
    ];

    let selectedLearnerIds = new Set();
    let selectedGroupId = 'all';

    let activeTab = 'matrix';
    let selectedTemplateId = '';
    const reportTabBtns = document.querySelectorAll('#view-reports .tab-btn');
    const compGroupContainer = document.getElementById('report_comp_group_container');
    const templateContainer = document.getElementById('report_template_container');
    const templateListEl = document.getElementById('report_template_list');

    reportTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            reportTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTab = btn.dataset.report;

            if (activeTab === 'matrix') {
                compGroupContainer.classList.remove('hidden');
                templateContainer.classList.add('hidden');
            } else {
                compGroupContainer.classList.add('hidden');
                templateContainer.classList.remove('hidden');
            }
            renderReport();
        });
    });

    // Listen for tab switch in global nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.target === 'view-reports') {
                renderSelectors();
                renderReport();
            }
        });
    });

    // Listen for auth/data load
    window.addEventListener('clk-data-loaded', () => {
        if (viewReports.classList.contains('active')) {
            renderSelectors();
            renderReport();
        }
    });

    learnerListEl.addEventListener('change', (e) => {
        if (!e.detail) return;
        selectedLearnerIds = new Set(e.detail.selectedIds);
        renderReport();
    });

    compGroupListEl.addEventListener('change', (e) => {
        if (!e.detail) return;
        selectedGroupId = e.detail.selectedValue;
        renderReport();
    });

    templateListEl.addEventListener('change', (e) => {
        selectedTemplateId = e.target.value;
        renderReport();
    });

    function renderSelectors() {
        const learners = AppState.rootData?.Student || [];
        const learnerGroups = AppState.rootData?.['Learner Group'] || [];
        learnerListEl.setLearners(learners, learnerGroups);

        const compGroups = AppState.rootData?.['Competency Group'] || [];

        const doSetGroups = () => {
            if (compGroupListEl.setGroups) {
                const currentValue = compGroupListEl.getValue();
                compGroupListEl.setGroups(compGroups);
                compGroupListEl.setValue(currentValue);
            }
        };

        if (customElements.get('competency-group-selector')) {
            doSetGroups();
        } else {
            customElements.whenDefined('competency-group-selector').then(doSetGroups);
        }

        const templates = AppState.rootData?.['Radial Report Template'] || [];
        const currentTemplateVal = templateListEl.value;
        templateListEl.innerHTML = '<option value="">Choose a template...</option>';
        templates.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            templateListEl.appendChild(opt);
        });
        if (currentTemplateVal && templates.find(t => t.id === currentTemplateVal)) {
            templateListEl.value = currentTemplateVal;
        }
    }

    async function renderReport() {
        if (activeTab === 'matrix') {
            await renderMatrixReport();
        } else {
            await renderIndividualReport();
        }
    }

    async function renderMatrixReport() {
        if (selectedLearnerIds.size === 0) {
            contentArea.innerHTML = '<p class="placeholder-text">Select at least one learner to view the report.</p>';
            return;
        }

        contentArea.innerHTML = '<p class="placeholder-text">Loading...</p>';

        const learners = AppState.rootData?.Student || [];
        const comps = AppState.rootData?.Competency || [];
        const groups = AppState.rootData?.['Competency Group'] || [];

        const activeGroup = selectedGroupId !== 'all' ? groups.find(g => g.id === selectedGroupId) : null;
        let selectedComps = [];
        if (activeGroup) {
            selectedComps = comps.filter(c => activeGroup.competencyIds && activeGroup.competencyIds.includes(c.id));
        } else {
            selectedComps = comps;
        }

        if (selectedComps.length === 0) {
            contentArea.innerHTML = '<p class="placeholder-text">No competencies found for this group.</p>';
            return;
        }

        const selectedLearners = learners.filter(s => selectedLearnerIds.has(s.learnerDataId));

        // Fetch all learner data
        const learnersData = {};
        for (const learner of selectedLearners) {
            try {
                learnersData[learner.learnerDataId] = await storage.readLearnerData(learner.learnerDataId);
            } catch (err) {
                console.error(`Error loading data for ${learner.name}:`, err);
                learnersData[learner.learnerDataId] = { Assessment: [] };
            }
        }

        // Build the table
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontSize = '0.9rem';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.style.background = 'var(--bg)';
        headerRow.style.borderBottom = '2px solid var(--border)';

        const thName = document.createElement('th');
        thName.style.padding = '12px';
        thName.style.textAlign = 'left';
        thName.style.position = 'sticky';
        thName.style.left = '0';
        thName.style.background = 'var(--bg)';
        thName.style.zIndex = '2';
        thName.textContent = 'Learner';
        headerRow.appendChild(thName);

        selectedComps.forEach(comp => {
            const th = document.createElement('th');
            th.style.padding = '12px';
            th.style.textAlign = 'center';
            th.style.minWidth = '120px';
            th.title = comp.description;
            th.textContent = comp.name;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        selectedLearners.forEach(learner => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';

            const tdName = document.createElement('td');
            tdName.style.padding = '12px';
            tdName.style.fontWeight = '500';
            tdName.style.position = 'sticky';
            tdName.style.left = '0';
            tdName.style.background = '#fff';
            tdName.style.zIndex = '1';
            tdName.textContent = learner.displayName || learner.name;
            tr.appendChild(tdName);

            const evidenceDict = learnersData[learner.learnerDataId];
            const assessments = evidenceDict?.Assessment || [];

            selectedComps.forEach(comp => {
                const td = document.createElement('td');
                td.style.padding = '12px';
                td.style.textAlign = 'center';

                const compAssessments = assessments.filter(a => a.competencyId === comp.id);
                if (compAssessments.length === 0) {
                    const span = document.createElement('span');
                    span.className = 'placeholder-text';
                    span.style.fontSize = '0.8rem';
                    span.textContent = 'Not Assessed';
                    td.appendChild(span);
                } else {
                    // Find latest assessment
                    const latest = compAssessments.reduce((prev, current) => {
                        return (new Date(prev.timestamp) > new Date(current.timestamp)) ? prev : current;
                    });

                    const ratingConf = summativeRatings.find(r => r.val === latest.rating);
                    const pill = document.createElement('div');
                    pill.style.display = 'inline-block';
                    pill.style.padding = '4px 8px';
                    pill.style.fontSize = '0.75rem';
                    pill.style.fontWeight = '600';
                    pill.style.color = '#fff';
                    pill.style.borderRadius = '4px';
                    pill.style.background = ratingConf ? ratingConf.color : 'var(--text-muted)';
                    pill.title = ratingConf ? ratingConf.title : 'Unknown';
                    pill.textContent = ratingConf ? ratingConf.label : '?';

                    td.appendChild(pill);
                }

                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        contentArea.innerHTML = '';
        contentArea.appendChild(table);
    }

    async function renderIndividualReport() {
        if (selectedLearnerIds.size === 0) {
            contentArea.innerHTML = '<p class="placeholder-text">Select at least one learner to view the report.</p>';
            return;
        }

        if (!selectedTemplateId) {
            contentArea.innerHTML = '<p class="placeholder-text">Select a report template from the left.</p>';
            return;
        }

        contentArea.innerHTML = '<p class="placeholder-text">Loading...</p>';

        const learners = AppState.rootData?.Student || [];
        const templates = AppState.rootData?.['Radial Report Template'] || [];
        const template = templates.find(t => t.id === selectedTemplateId);

        if (!template) {
            contentArea.innerHTML = '<p class="placeholder-text">Template not found.</p>';
            return;
        }

        const allCompetencies = AppState.rootData?.Competency || [];

        const parseConfig = (configStr) => {
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
        };

        const enrichData = (dataArr) => {
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
        };

        const selectedLearners = learners.filter(s => selectedLearnerIds.has(s.learnerDataId));

        // Fetch all learner data
        const learnersData = {};
        for (const learner of selectedLearners) {
            try {
                learnersData[learner.learnerDataId] = await storage.readLearnerData(learner.learnerDataId);
            } catch (err) {
                console.error(`Error loading data for ${learner.name}:`, err);
                learnersData[learner.learnerDataId] = { Assessment: [] };
            }
        }

        contentArea.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'card-grid';

        for (const learner of selectedLearners) {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.gap = '16px';

            const title = document.createElement('h3');
            title.textContent = learner.displayName || learner.name;
            title.style.margin = '0';
            card.appendChild(title);

            const evidenceDict = learnersData[learner.learnerDataId];
            const assessments = evidenceDict?.Assessment || [];

            // Build template data to inject scores
            const rawData = parseConfig(template.config);
            const enrichedData = enrichData(rawData);
            const chartData = JSON.parse(JSON.stringify(enrichedData));

            for (let i = 0; i < chartData.length; i++) {
                for (let j = 0; j < chartData[i].length; j++) {
                    const node = chartData[i][j];
                    const compId = node.id;

                    const compAssessments = assessments.filter(a => a.competencyId === compId);
                    if (compAssessments.length > 0) {
                        const latest = compAssessments.reduce((prev, current) => {
                            return (new Date(prev.timestamp) > new Date(current.timestamp)) ? prev : current;
                        });
                        node.score = latest.rating; // 0.0, 0.5, 1.0
                    } else {
                        node.score = null; // Not assessed
                    }
                }
            }

            const sunburstContainer = document.createElement('div');
            sunburstContainer.style.width = '100%';
            sunburstContainer.style.aspectRatio = '1 / 1';
            sunburstContainer.style.display = 'flex';
            sunburstContainer.style.justifyContent = 'center';
            sunburstContainer.style.alignItems = 'center';

            const sunburst = document.createElement('clk-sunburst');
            sunburstContainer.appendChild(sunburst);
            card.appendChild(sunburstContainer);
            grid.appendChild(card);

            // Important: component needs to be attached to DOM before rendering size
            setTimeout(() => {
                const levels = Math.max(3, chartData.length);
                sunburst.setConfig(levels, template.innerRadius || 50, template.outerRadius || 250, chartData);
                sunburst.setMode('report');
            }, 0);
        }

        contentArea.appendChild(grid);
    }
}
