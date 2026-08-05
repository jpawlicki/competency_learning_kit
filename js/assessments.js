export function initAssessmentsView(AppState, uiPrefs, storage) {
    const viewAssessments = document.getElementById('view-assessments');
    const learnerListEl = document.getElementById('assess_learner_list');
    const gridContainer = document.getElementById('assess_grid_container');
    
    const obsModal = document.getElementById('obs_detail_modal');
    const obsModalClose = document.getElementById('obs_modal_close');
    const obsModalContent = document.getElementById('obs_modal_content');
    const obsModalTitle = document.getElementById('obs_modal_title');
    
    let selectedLearnerIds = new Set();
    
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
        if (viewAssessments.classList.contains('active')) {
            renderLearnerList();
        }
    });

    // Listen for global filter changes from app.js
    window.addEventListener('clk-filter-changed', () => {
        if (viewAssessments.classList.contains('active')) {
            renderAssessmentGrid();
        }
    });

    obsModalClose.addEventListener('click', () => {
        obsModal.classList.add('hidden');
        obsModal.style.display = 'none'; // Ensure it's hidden
    });

    function renderLearnerList() {
        learnerListEl.innerHTML = '';
        const learners = AppState.rootData?.Student || [];
        
        if (learners.length === 0) {
            learnerListEl.innerHTML = '<div class="placeholder-text">No learners found.</div>';
            return;
        }

        const selectAllDiv = document.createElement('div');
        selectAllDiv.style.display = 'flex';
        selectAllDiv.style.alignItems = 'center';
        selectAllDiv.style.gap = '8px';
        selectAllDiv.style.paddingBottom = '8px';
        selectAllDiv.style.borderBottom = '1px solid var(--border)';
        selectAllDiv.style.marginBottom = '8px';
        
        const selectAllCb = document.createElement('input');
        selectAllCb.type = 'checkbox';
        selectAllCb.id = 'assess_select_all';
        
        const selectAllLabel = document.createElement('label');
        selectAllLabel.htmlFor = 'assess_select_all';
        selectAllLabel.textContent = 'Select All';
        selectAllLabel.style.fontWeight = '600';
        
        selectAllCb.addEventListener('change', (e) => {
            const checked = e.target.checked;
            learnerListEl.querySelectorAll('input[type="checkbox"]:not(#assess_select_all)').forEach(cb => {
                cb.checked = checked;
            });
            if (checked) {
                learners.forEach(s => selectedLearnerIds.add(s.learnerDataId));
            } else {
                selectedLearnerIds.clear();
            }
            renderAssessmentGrid();
        });
        
        selectAllDiv.appendChild(selectAllCb);
        selectAllDiv.appendChild(selectAllLabel);
        learnerListEl.appendChild(selectAllDiv);

        learners.sort((a,b) => a.name.localeCompare(b.name)).forEach(s => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '8px';
            
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.id = `assess_learner_${s.learnerDataId}`;
            cb.value = s.learnerDataId;
            cb.checked = selectedLearnerIds.has(s.learnerDataId);
            
            const label = document.createElement('label');
            label.htmlFor = cb.id;
            label.textContent = s.displayName || s.name;
            label.style.cursor = 'pointer';
            
            cb.addEventListener('change', (e) => {
                if (e.target.checked) {
                    selectedLearnerIds.add(s.learnerDataId);
                    addLearnerToGrid(s.learnerDataId);
                } else {
                    selectedLearnerIds.delete(s.learnerDataId);
                    removeLearnerFromGrid(s.learnerDataId);
                }
                
                const allChecked = Array.from(learnerListEl.querySelectorAll('input[type="checkbox"]:not(#assess_select_all)'))
                    .every(c => c.checked);
                selectAllCb.checked = allChecked;
            });
            
            div.appendChild(cb);
            div.appendChild(label);
            learnerListEl.appendChild(div);
        });
        
        renderAssessmentGrid();
    }

    function getFilteredComps() {
        const competencies = AppState.rootData?.Competency || [];
        const groups = AppState.rootData?.CompetencyGroup || [];
        const filterGroupDropdown = document.getElementById('toolbar_filter_group');
        const activeGroupId = filterGroupDropdown ? filterGroupDropdown.value : '';
        
        if (activeGroupId && activeGroupId !== '') {
            const group = groups.find(g => g.id === activeGroupId);
            if (group) {
                return competencies.filter(c => group.competencyIds && group.competencyIds.includes(c.id));
            }
        }
        return competencies;
    }

    async function renderAssessmentGrid() {
        gridContainer.innerHTML = '';
        
        if (selectedLearnerIds.size === 0) {
            gridContainer.innerHTML = '<div id="assess_initial_placeholder" class="placeholder-text card">Select learners from the left to begin.</div>';
            return;
        }

        const filteredComps = getFilteredComps();
        if (filteredComps.length === 0) {
            gridContainer.innerHTML = '<div id="assess_initial_placeholder" class="placeholder-text card">No competencies found in the selected view/filter.</div>';
            return;
        }

        for (const learnerId of selectedLearnerIds) {
            const section = await renderLearnerSection(learnerId, filteredComps);
            if (section) gridContainer.appendChild(section);
        }
    }
    
    async function addLearnerToGrid(learnerId) {
        const initialPlaceholder = gridContainer.querySelector('#assess_initial_placeholder');
        if (initialPlaceholder) {
            initialPlaceholder.remove();
        }
        
        const filteredComps = getFilteredComps();
        if (filteredComps.length === 0) {
            if (gridContainer.children.length === 0) {
                gridContainer.innerHTML = '<div id="assess_initial_placeholder" class="placeholder-text card">No competencies found in the selected view/filter.</div>';
            }
            return;
        }
        
        const section = await renderLearnerSection(learnerId, filteredComps);
        if (section) gridContainer.appendChild(section);
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
        section.style.overflow = 'hidden';
        
        const header = document.createElement('div');
        header.style.padding = '12px 16px';
        header.style.background = 'var(--primary-bg)';
        header.style.borderBottom = '1px solid var(--border)';
        header.style.fontWeight = '600';
        header.style.fontSize = '1.1rem';
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
        
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr style="background: var(--bg); border-bottom: 2px solid var(--border);">
                <th style="padding: 12px; text-align: left; position: sticky; left: 0; background: var(--bg); z-index: 2;">Competency Assessment</th>
            </tr>
        `;
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        
        filteredComps.forEach(comp => {
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
            
            // Middle: Timeline and Assessment Marker
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
            timelineDiv.style.justifyContent = 'space-between';
            timelineDiv.style.flexWrap = 'nowrap';
            timelineDiv.style.overflowX = 'auto';
            timelineDiv.style.alignItems = 'center';
            
            // Deduplicate summative assessments by taking the latest timestamp for each ID
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
            
            const markerDiv = document.createElement('div');
            markerDiv.style.padding = '4px 8px';
            markerDiv.style.fontSize = '0.7rem';
            markerDiv.style.fontWeight = '600';
            markerDiv.style.color = '#fff';
            markerDiv.style.borderRadius = '4px';
            markerDiv.style.background = 'var(--text-muted)';
            markerDiv.style.border = '2px solid rgba(0,0,0,0.1)';
            markerDiv.style.flexShrink = '0';
            markerDiv.textContent = '?';
            
            timelineDiv.appendChild(markerDiv);
            compMid.appendChild(timelineDiv);
            rowContent.appendChild(compMid);
            
            // Bottom: Assessment Entry Form
            const compBot = document.createElement('div');
            compBot.style.display = 'flex';
            compBot.style.flexDirection = 'column';
            compBot.style.gap = '8px';
            
            const btnRow = document.createElement('div');
            btnRow.style.display = 'flex';
            btnRow.style.gap = '4px';
            
            let currentRating = undefined;
            
            const btns = summativeRatings.map(sr => {
                const btn = document.createElement('button');
                btn.textContent = sr.label;
                btn.title = sr.title;
                btn.style.flex = '1';
                btn.style.padding = '6px 4px';
                btn.style.fontSize = '0.75rem';
                btn.style.borderRadius = '4px';
                btn.style.cursor = 'pointer';
                btn.style.border = '1px solid var(--border)';
                btn.style.background = 'var(--bg)';
                btn.style.color = 'var(--text-main)';
                btn.style.fontWeight = '400';
                
                btn.onclick = () => {
                    markUnsaved();
                    currentRating = sr.val;
                    Array.from(btnRow.children).forEach((b, i) => {
                        b.style.border = currentRating === summativeRatings[i].val ? `1px solid ${summativeRatings[i].color}` : '1px solid var(--border)';
                        b.style.background = currentRating === summativeRatings[i].val ? summativeRatings[i].color : 'var(--bg)';
                        b.style.color = currentRating === summativeRatings[i].val ? '#fff' : 'var(--text-main)';
                        b.style.fontWeight = currentRating === summativeRatings[i].val ? '600' : '400';
                    });
                    
                    markerDiv.textContent = sr.label;
                    markerDiv.style.background = sr.color;
                    markerDiv.style.color = '#fff';
                    markerDiv.style.borderColor = 'rgba(0,0,0,0.1)';
                };
                return btn;
            });
            btns.forEach(b => btnRow.appendChild(b));
            
            const noteInput = document.createElement('input');
            noteInput.type = 'text';
            noteInput.className = 'input-text';
            noteInput.placeholder = 'Summative Note...';
            noteInput.style.fontSize = '0.8rem';
            noteInput.style.padding = '6px';
            noteInput.value = '';
            noteInput.addEventListener('input', markUnsaved);
            
            const guideInput = document.createElement('input');
            guideInput.type = 'text';
            guideInput.className = 'input-text';
            guideInput.placeholder = 'Guidance / Next Steps...';
            guideInput.style.fontSize = '0.8rem';
            guideInput.style.padding = '6px';
            guideInput.value = '';
            guideInput.addEventListener('input', markUnsaved);
            
            const submitBtn = document.createElement('button');
            submitBtn.className = 'btn-primary';
            submitBtn.style.padding = '6px 12px';
            submitBtn.style.fontSize = '0.8rem';
            submitBtn.textContent = 'Save Assessment';
            
            function markUnsaved() {
                if (submitBtn.textContent === 'Saved!' || submitBtn.disabled) {
                    submitBtn.textContent = submitBtn.dataset.assessmentId ? 'Update Assessment' : 'Save Assessment';
                    submitBtn.style.background = '';
                    submitBtn.style.borderColor = '';
                    submitBtn.disabled = false;
                }
            }

            submitBtn.onclick = async () => {
                if (currentRating === undefined) {
                    alert("Please select a rating.");
                    return;
                }
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
                
                const isUpdate = !!submitBtn.dataset.assessmentId;
                const newId = isUpdate ? submitBtn.dataset.assessmentId : `ass_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
                
                const assessment = {
                    id: newId,
                    competencyId: comp.id,
                    assessorEmail: uiPrefs.getUserEmail() || 'unknown',
                    rating: currentRating,
                    summativeNote: noteInput.value.trim(),
                    guidance: guideInput.value.trim(),
                    timestamp: new Date().toISOString()
                };
                
                try {
                    await storage.addAssessment(learnerId, assessment);
                    submitBtn.dataset.assessmentId = newId;
                    submitBtn.textContent = 'Saved!';
                    submitBtn.style.background = 'var(--success, #10b981)';
                    submitBtn.style.borderColor = 'var(--success, #10b981)';
                } catch (err) {
                    console.error(err);
                    alert("Error saving assessment: " + err.message);
                    submitBtn.textContent = submitBtn.dataset.assessmentId ? 'Update Assessment' : 'Save Assessment';
                    submitBtn.style.background = '';
                    submitBtn.style.borderColor = '';
                    submitBtn.disabled = false;
                }
            };
            
            compBot.appendChild(btnRow);
            compBot.appendChild(noteInput);
            compBot.appendChild(guideInput);
            compBot.appendChild(submitBtn);
            
            rowContent.appendChild(compBot);
            td.appendChild(rowContent);
            tr.appendChild(td);
            
            tbody.appendChild(tr);
        });
        
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
}
