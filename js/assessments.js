export function initAssessmentsView(AppState, uiPrefs, storage) {
    const viewAssessments = document.getElementById('view-assessments');
    const learnerListEl = document.getElementById('assess_learner_list');
    const gridContainer = document.getElementById('assess_grid_container');
    
    const obsModal = document.getElementById('obs_detail_modal');
    const obsModalClose = document.getElementById('obs_modal_close');
    const obsModalContent = document.getElementById('obs_modal_content');
    const obsModalTitle = document.getElementById('obs_modal_title');
    
    let selectedLearnerIds = new Set();
    const unsavedAssessments = new Map();
    const saveAllBtn = document.getElementById('assess_save_all');

    function updateGlobalSaveBtn() {
        if (!saveAllBtn) return;
        if (unsavedAssessments.size > 0) {
            saveAllBtn.style.display = 'inline-block';
            saveAllBtn.textContent = `Save Changes (${unsavedAssessments.size})`;
            saveAllBtn.className = 'btn-primary floating-save-btn';
            saveAllBtn.disabled = false;
        } else {
            saveAllBtn.style.display = 'none';
        }
    }

    if (saveAllBtn) {
        saveAllBtn.addEventListener('click', async () => {
            if (unsavedAssessments.size === 0) return;
            saveAllBtn.disabled = true;
            saveAllBtn.textContent = 'Saving...';
            
            let errors = 0;
            for (const [key, assess] of unsavedAssessments.entries()) {
                const learnerId = assess.learnerId;
                delete assess.learnerId; // remove temp property
                try {
                    await storage.addAssessment(learnerId, assess);
                } catch (e) {
                    console.error(e);
                    errors++;
                }
            }
            if (errors > 0) {
                alert("Saved with errors. Check console.");
                saveAllBtn.disabled = false;
                saveAllBtn.textContent = 'Retry Save';
            } else {
                unsavedAssessments.clear();
                updateGlobalSaveBtn();
                renderAssessmentGrid();
                if(saveAllBtn) {
                   saveAllBtn.className = 'btn-primary floating-save-btn success'; 
                }
            }
        });
    }

    window.addEventListener('beforeunload', (e) => {
        if (unsavedAssessments.size > 0) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    
    // Rating Config for Summative Assessments
    const summativeRatings = [
        { val: 0.0, label: 'Never/Rarely', title: 'Never/Rarely Demonstrates', color: '#ef4444' },
        { val: 0.5, label: 'Sometimes', title: 'Sometimes Demonstrates', color: '#f59e0b' },
        { val: 1.0, label: 'Reliably', title: 'Reliably Demonstrates', color: '#10b981' }
    ];
    
    // Rating Config for Observations (from Evidence)
    const observationRatings = {
        0.0: { label: 'NY', color: '#ef4444', title: 'Not Yet' },
        0.5: { label: 'DEV', color: '#f59e0b', title: 'Developing' },
        1.0: { label: 'DEM', color: '#10b981', title: 'Demonstrates' }
    };
    
    // Listen for tab switch
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.target === 'view-assessments') {
                renderLearnerList();
            }
        });
    });
    
    // Listen for auth/data load
    window.addEventListener('clk-data-loaded', () => {
        renderAssessGroupSelect();
        if (viewAssessments.classList.contains('active')) {
            renderLearnerList();
        }
    });

    const assessGroupSelect = document.getElementById('assess_group_select');
    if (assessGroupSelect) {
        assessGroupSelect.addEventListener('change', (e) => {
            if (unsavedAssessments.size > 0) {
                if (!confirm("You have unsaved changes. Change group and lose changes?")) {
                    // Reverting group select is hard without state tracking, but let's just warn for now
                    // If they cancel, we can try to re-render to the old group? 
                    // To keep it simple, we just warn and if they say OK, we clear unsaved.
                } else {
                    unsavedAssessments.clear();
                    updateGlobalSaveBtn();
                    renderAssessmentGrid();
                }
                return;
            }
            renderAssessmentGrid();
        });
    }

    // Listen for global filter changes from app.js
    window.addEventListener('clk-filter-changed', () => {
        if (viewAssessments.classList.contains('active')) {
            renderAssessmentGrid();
        }
    });

    function renderAssessGroupSelect() {
        const groups = AppState.rootData?.['Competency Group'] || [];
        if (!assessGroupSelect) return;
        
        const doSetGroups = () => {
            if (assessGroupSelect.setGroups) {
                const currentValue = assessGroupSelect.getValue();
                assessGroupSelect.setGroups(groups);
                assessGroupSelect.setValue(currentValue);
            }
        };

        if (customElements.get('competency-group-selector')) {
            doSetGroups();
        } else {
            customElements.whenDefined('competency-group-selector').then(doSetGroups);
        }
    }

    obsModalClose.addEventListener('click', () => {
        obsModal.classList.add('hidden');
        obsModal.style.display = 'none'; // Ensure it's hidden
    });

    // Listen for custom element changes
    learnerListEl.addEventListener('change', (e) => {
        if (!e.detail) return;
        const newSelected = new Set(e.detail.selectedIds);
        
        // Additions
        for (const id of newSelected) {
            if (!selectedLearnerIds.has(id)) {
                selectedLearnerIds.add(id);
                addLearnerToGrid(id);
            }
        }
        
        // Removals
        for (const id of selectedLearnerIds) {
            if (!newSelected.has(id)) {
                // Check if this learner has unsaved changes
                let hasUnsaved = false;
                for (const key of unsavedAssessments.keys()) {
                    if (key.startsWith(id + '_')) {
                        hasUnsaved = true;
                        break;
                    }
                }
                
                if (hasUnsaved) {
                    if (!confirm("This learner has unsaved assessments. Remove them and discard changes?")) {
                        // Keep them selected in UI by triggering a re-render or re-checking
                        // Easiest is to just re-add them to learnerListEl
                        learnerListEl.toggleLearner(id, true);
                        continue;
                    } else {
                        // Discard their unsaved changes
                        for (const key of unsavedAssessments.keys()) {
                            if (key.startsWith(id + '_')) unsavedAssessments.delete(key);
                        }
                        updateGlobalSaveBtn();
                    }
                }
                
                selectedLearnerIds.delete(id);
                removeLearnerFromGrid(id);
            }
        }
    });

    function renderLearnerList() {
        const learners = AppState.rootData?.Student || [];
        const groups = AppState.rootData?.['Learner Group'] || [];
        learnerListEl.setLearners(learners, groups);
        
        // The element retains its selected states internally across re-renders if valid,
        // but we should sync our local Set with its state.
        const currentSelected = new Set(learnerListEl.getSelectedLearners());
        let needsReRender = false;
        
        for (const id of selectedLearnerIds) {
            if (!currentSelected.has(id)) {
                selectedLearnerIds.delete(id);
                needsReRender = true;
            }
        }
        
        if (needsReRender) {
            renderAssessmentGrid();
        }
    }



    function renderAssessmentGrid() {
        gridContainer.innerHTML = '';
        
        if (selectedLearnerIds.size === 0) {
            gridContainer.innerHTML = '<div id="assess_initial_placeholder" class="placeholder-text card">Select learners from the left to begin.</div>';
            return;
        }

        const comps = AppState.rootData?.Competency || [];
        if (comps.length === 0) {
            gridContainer.innerHTML = '<div id="assess_initial_placeholder" class="placeholder-text card">No competencies found in the system.</div>';
            return;
        }

        for (const learnerId of selectedLearnerIds) {
            const section = document.createElement('div');
            section.className = 'card assess-learner-section';
            section.dataset.learnerId = learnerId;
            section.style.marginBottom = '24px';
            section.style.padding = '0';
            section.style.padding = '0';
            section.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted);">Loading...</div>';
            
            gridContainer.appendChild(section);

            renderLearnerSection(learnerId, comps).then(populatedSection => {
                if (populatedSection) {
                    section.replaceWith(populatedSection);
                } else {
                    section.remove();
                }
            });
        }
    }
    
    async function addLearnerToGrid(learnerId) {
        if (gridContainer.querySelector(`div[data-learner-id="${learnerId}"]`)) return;

        const initialPlaceholder = gridContainer.querySelector('#assess_initial_placeholder');
        if (initialPlaceholder) initialPlaceholder.remove();

        const section = document.createElement('div');
        section.className = 'card assess-learner-section';
        section.dataset.learnerId = learnerId;
        section.style.marginBottom = '24px';
        section.style.padding = '0';
        section.style.padding = '0';
        section.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted);">Loading...</div>';
        
        gridContainer.appendChild(section);

        const comps = AppState.rootData?.Competency || [];
        if (comps.length === 0) {
            section.remove();
            if (gridContainer.children.length === 0) {
                gridContainer.innerHTML = '<div id="assess_initial_placeholder" class="placeholder-text card">No competencies found in the system.</div>';
            }
            return;
        }

        const populatedSection = await renderLearnerSection(learnerId, comps);
        if (populatedSection) {
            section.replaceWith(populatedSection);
        } else {
            section.remove();
        }
    }
    
    function removeLearnerFromGrid(learnerId) {
        const section = gridContainer.querySelector(`div[data-learner-id="${learnerId}"]`);
        if (section) {
            section.remove();
        }
        if (selectedLearnerIds.size === 0) {
            gridContainer.innerHTML = '<div id="assess_initial_placeholder" class="placeholder-text card">Select learners from the left to begin.</div>';
        }
    }

    async function renderLearnerSection(learnerId, filteredComps) {
        const learners = AppState.rootData?.Student || [];
        const learner = learners.find(s => s.learnerDataId === learnerId);
        if (!learner) return null;
        
        const section = document.createElement('div');
        section.className = 'card assess-learner-section';
        section.dataset.learnerId = learnerId;
        section.style.marginBottom = '24px';
        section.style.padding = '0';
        section.style.padding = '0';
        
        const header = document.createElement('div');
        header.style.padding = '12px 16px';
        header.style.background = 'var(--primary-bg)';
        header.style.borderBottom = '1px solid var(--border)';
        header.style.fontWeight = '600';
        header.style.fontSize = '1.1rem';
        header.style.position = 'sticky';
        header.style.top = '70px';
        header.style.zIndex = '10';
        header.style.borderTopLeftRadius = 'calc(var(--radius-md, 8px) - 1px)';
        header.style.borderTopRightRadius = 'calc(var(--radius-md, 8px) - 1px)';
        header.textContent = learner.displayName || learner.name;
        section.appendChild(header);
        
        let evidenceDict = null;
        try {
            evidenceDict = await storage.readLearnerData(learnerId);
        } catch (err) {
            console.error("Error loading learner data:", err);
        }
        
        const observations = evidenceDict?.Observation || [];
        const evidences = evidenceDict?.Evidence || [];
        const summativeAssessments = evidenceDict?.Assessment || [];
        
        const tableWrap = document.createElement('div');
        tableWrap.style.overflowX = 'auto';
        tableWrap.style.background = '#fff';
        
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontSize = '0.9rem';
        
        const tbody = document.createElement('tbody');
        
        const activeGroupId = (assessGroupSelect && assessGroupSelect.getValue) ? assessGroupSelect.getValue() : 'all';
        const groups = AppState.rootData?.['Competency Group'] || [];
        const activeGroup = activeGroupId !== 'all' ? groups.find(g => g.id === activeGroupId) : null;
        
        let addedCount = 0;
        
        filteredComps.forEach(comp => {
            let includeComp = false;
            
            if (activeGroupId === 'all') {
                includeComp = true;
            } else if (activeGroup && activeGroup.competencyIds && activeGroup.competencyIds.includes(comp.id)) {
                includeComp = true;
            }
            
            if (!includeComp) {
                // Check if there are observations more recent than the last assessment
                const compObs = observations.filter(o => o.competencyId === comp.id);
                const compAssess = summativeAssessments.filter(a => a.competencyId === comp.id);
                
                let lastAssessTime = 0;
                if (compAssess.length > 0) {
                    lastAssessTime = Math.max(...compAssess.map(a => new Date(a.date).getTime()));
                }
                
                const hasNewer = compObs.some(o => new Date(o.date).getTime() > lastAssessTime);
                if (hasNewer) {
                    includeComp = true;
                }
            }
            
            if (!includeComp) return;
            addedCount++;
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            
            const td = document.createElement('td');
            td.style.padding = '16px';
            
            const rowContent = document.createElement('div');
            rowContent.style.display = 'flex';
            rowContent.style.flexDirection = 'column';
            rowContent.style.gap = '12px';
            
            // Top: Competency Name - Description
            const compTop = document.createElement('div');
            
            const compName = document.createElement('span');
            compName.style.fontWeight = '600';
            compName.style.fontSize = '1.05rem';
            compName.textContent = comp.name;
            
            const compDesc = document.createElement('span');
            compDesc.style.color = 'var(--text-muted)';
            compDesc.style.marginLeft = '8px';
            compDesc.textContent = '- ' + comp.description;
            
            compTop.appendChild(compName);
            compTop.appendChild(compDesc);
            rowContent.appendChild(compTop);
            
            // Middle: Timeline and Buttons
            const compMid = document.createElement('div');
            compMid.style.display = 'flex';
            compMid.style.alignItems = 'center';
            compMid.style.background = 'var(--primary-bg)';
            compMid.style.padding = '12px';
            compMid.style.borderRadius = '6px';
            compMid.style.border = '1px solid var(--border)';
            
            const timelineDiv = document.createElement('div');
            timelineDiv.style.flex = '1';
            timelineDiv.style.display = 'flex';
            timelineDiv.style.gap = '8px';
            timelineDiv.style.justifyContent = 'flex-start';
            timelineDiv.style.flexWrap = 'nowrap';
            timelineDiv.style.overflowX = 'auto';
            timelineDiv.style.alignItems = 'center';
            
            const uniqueAssessments = Array.from(
                summativeAssessments
                    .sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp))
                    .reduce((map, a) => {
                        map.set(a.id, a);
                        return map;
                    }, new Map())
                    .values()
            );

            const compObs = observations.filter(o => o.competencyId === comp.id);
            const compAss = uniqueAssessments.filter(a => a.competencyId === comp.id);
            
            const combinedTimeline = [
                ...compObs.map(o => ({ ...o, type: 'observation' })),
                ...compAss.map(a => ({ ...a, type: 'assessment' }))
            ].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            if (combinedTimeline.length === 0) {
                const empty = document.createElement('span');
                empty.className = 'placeholder-text';
                empty.style.fontSize = '0.8rem';
                empty.style.padding = '0';
                empty.textContent = 'No prior evidence.';
                timelineDiv.appendChild(empty);
            } else {
                combinedTimeline.forEach(item => {
                    const pill = document.createElement('div');
                    pill.style.padding = '4px 8px';
                    pill.style.fontSize = '0.7rem';
                    pill.style.fontWeight = '600';
                    pill.style.color = '#fff';
                    pill.style.cursor = 'pointer';
                    pill.style.flexShrink = '0';
                    
                    if (item.type === 'observation') {
                        const ev = evidences.find(e => e.id === item.evidenceId);
                        const ratingConf = observationRatings[item.rating];
                        pill.style.borderRadius = '12px';
                        pill.style.background = ratingConf ? ratingConf.color : 'var(--text-muted)';
                        pill.title = ratingConf ? ratingConf.title : 'Unknown';
                        pill.textContent = ratingConf ? ratingConf.label : '?';
                        pill.addEventListener('click', () => {
                            showObservationDetails(item, ev, comp);
                        });
                    } else {
                        const ratingConf = summativeRatings.find(r => r.val === item.rating);
                        pill.style.borderRadius = '4px';
                        pill.style.background = ratingConf ? ratingConf.color : 'var(--text-muted)';
                        pill.style.border = '2px solid rgba(0,0,0,0.1)';
                        pill.title = ratingConf ? ratingConf.title : 'Summative Assessment';
                        pill.textContent = ratingConf ? ratingConf.label : '?';
                        pill.addEventListener('click', () => {
                            showObservationDetails(item, null, comp);
                        });
                    }
                    timelineDiv.appendChild(pill);
                });
            }
            
            compMid.appendChild(timelineDiv);

            // Stack buttons to the right of the timeline
            const btnRow = document.createElement('div');
            btnRow.style.display = 'flex';
            btnRow.style.gap = '4px';
            btnRow.style.marginLeft = '16px';
            btnRow.style.flexShrink = '0';
// Bottom: Assessment Entry Form
            const compBot = document.createElement('div');
            compBot.style.display = 'flex';
            compBot.style.flexDirection = 'column';
            compBot.style.gap = '8px';
            
            const stateKey = `${learnerId}_${comp.id}`;
            let currentState = unsavedAssessments.get(stateKey) || {};
            let currentRating = currentState.rating !== undefined ? currentState.rating : undefined;
            
            function updateUnsavedState() {
                if (currentRating === undefined && !noteInput.value.trim() && !guideInput.value.trim()) {
                    unsavedAssessments.delete(stateKey);
                } else {
                    unsavedAssessments.set(stateKey, {
                        learnerId: learnerId,
                        id: `ass_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
                        competencyId: comp.id,
                        assessorEmail: uiPrefs.getUserEmail() || 'unknown',
                        rating: currentRating,
                        summativeNote: noteInput.value.trim(),
                        guidance: guideInput.value.trim(),
                        timestamp: new Date().toISOString()
                    });
                }
                updateGlobalSaveBtn();
            }

            const btns = summativeRatings.map(sr => {
                const btn = document.createElement('button');
                btn.textContent = sr.label;
                btn.title = sr.title;
                btn.className = 'btn-rating';
                
                if (currentRating === sr.val) {
                    btn.classList.add('selected');
                    btn.style.border = `1px solid ${sr.color}`;
                    btn.style.background = sr.color;
                }
                
                btn.onclick = () => {
                    if (currentRating === sr.val) {
                        currentRating = undefined; // toggle off
                    } else {
                        currentRating = sr.val;
                    }
                    
                    Array.from(btnRow.children).forEach((b, i) => {
                        if (currentRating === summativeRatings[i].val) {
                            b.classList.add('selected');
                            b.style.border = `1px solid ${summativeRatings[i].color}`;
                            b.style.background = summativeRatings[i].color;
                        } else {
                            b.classList.remove('selected');
                            b.style.border = '1px solid var(--border)';
                            b.style.background = 'var(--bg)';
                        }
                    });
                    
                    updateUnsavedState();
                };
                return btn;
            });
            btns.forEach(b => btnRow.appendChild(b));
            compMid.appendChild(btnRow);
            rowContent.appendChild(compMid);
            
            const noteInput = document.createElement('input');
            noteInput.type = 'text';
            noteInput.className = 'input-text';
            noteInput.placeholder = 'Summative Note...';
            noteInput.style.fontSize = '0.8rem';
            noteInput.style.padding = '6px';
            noteInput.value = currentState.summativeNote || '';
            noteInput.addEventListener('input', updateUnsavedState);
            
            const guideInput = document.createElement('input');
            guideInput.type = 'text';
            guideInput.className = 'input-text';
            guideInput.placeholder = 'Guidance / Next Steps...';
            guideInput.style.fontSize = '0.8rem';
            guideInput.style.padding = '6px';
            guideInput.value = currentState.guidance || '';
            guideInput.addEventListener('input', updateUnsavedState);
            
            compBot.appendChild(noteInput);
            compBot.appendChild(guideInput);
            
rowContent.appendChild(compBot);
            td.appendChild(rowContent);
            tr.appendChild(td);
            
            tbody.appendChild(tr);
        });
        
        if (addedCount === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td style="padding: 16px; text-align: center; color: var(--text-muted);">No matching competencies or recent observations found for this learner.</td>`;
            tbody.appendChild(tr);
        }
        
        table.appendChild(tbody);
        tableWrap.appendChild(table);
        section.appendChild(tableWrap);
        return section;
    }
    
    function showObservationDetails(obs, ev, comp) {
        const isAssessment = ev === null;
        obsModalTitle.textContent = isAssessment ? 'Assessment Details' : 'Observation Details';
        obsModalContent.innerHTML = '';
        
        const ratingConf = isAssessment ? summativeRatings.find(r => r.val === obs.rating) : observationRatings[obs.rating];
        
        let html = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div><strong>Competency:</strong> ${comp.name}</div>
                <div><strong>Rating:</strong> <span style="color: ${ratingConf ? ratingConf.color : 'inherit'}; font-weight: 600;">${ratingConf ? ratingConf.title : 'Unknown'}</span></div>
                <hr style="border: 0; border-top: 1px solid var(--border); margin: 4px 0;" />
        `;
        
        if (isAssessment) {
            html += `
                <div><strong>Summative Note:</strong> ${obs.summativeNote ? obs.summativeNote : '<em>No notes</em>'}</div>
                <div><strong>Guidance:</strong> ${obs.guidance ? obs.guidance : '<em>No guidance</em>'}</div>
                <div><strong>Timestamp:</strong> ${new Date(obs.timestamp).toLocaleString()}</div>
                <div><strong>Assessor:</strong> ${obs.assessorEmail || 'Unknown'}</div>
            `;
        } else {
            html += `
                <div><strong>Evidence Name:</strong> ${ev ? ev.name : 'Unknown'}</div>
                <div><strong>Evidence Note:</strong> ${ev && ev.note ? ev.note : '<em>No notes</em>'}</div>
                <div><strong>Timestamp:</strong> ${new Date(obs.timestamp).toLocaleString()}</div>
                <div><strong>Author:</strong> ${obs.authorEmail || 'Unknown'}</div>
            `;
        }
        
        html += `</div>`;
        obsModalContent.innerHTML = html;
        
        obsModal.style.display = 'flex';
        obsModal.classList.remove('hidden');
    }

    // Initial load for custom elements
    renderAssessGroupSelect();
}
