export function initEvidenceBatchUI(AppState, storage, classroom, uiPrefs) {
    const courseSelect = document.getElementById('evidence_classroom_selector');
    const assignSelect = document.getElementById('evidence_assignment_selector');
    const nameInput = document.getElementById('evidence_name');
    const learnerListEl = document.getElementById('evidence_learner_list');
    
    const suggestedContainer = document.getElementById('evidence_assignment_goals_container');
    const suggestedList = document.getElementById('evidence_assignment_goals_list');
    
    const recentContainer = document.getElementById('evidence_recent_goals_container');
    const recentList = document.getElementById('evidence_recent_goals_list');
    
    const filteredContainer = document.getElementById('evidence_filtered_goals_container');
    const filteredTitle = document.getElementById('evidence_filtered_title');
    const filteredList = document.getElementById('evidence_filtered_goals_list');
    
    const allList = document.getElementById('evidence_goals_selector');
    
    const tableHeadRow = document.querySelector('#batch_rating_table thead tr');
    const tbody = document.getElementById('batch_rating_tbody');
    
    const noteInput = document.getElementById('evidence_note');
    const fileInput = document.getElementById('evidence_file');
    const submitBtn = document.getElementById('submit_evidence_button');
    
    let selectedLearnerIds = new Set();
    let selectedGoalIds = new Set();
    // store ratings as: learnerId -> goalId -> rating
    let ratings = {};
    let classroomScores = {};
    
    let courses = [];
    let courseworkCache = {};

    function getSelectedGroup() {
        const filterEl = document.getElementById('competency-group-select');
        return filterEl ? filterEl.value : 'ALL';
    }

    async function loadClassrooms() {
        try {
            courses = await classroom.fetchClassrooms();
            courseSelect.innerHTML = '<option value="">-- No Classroom Sync --</option>';
            courses.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                courseSelect.appendChild(opt);
            });
        } catch (e) {
            console.warn("Could not load classrooms:", e);
        }
    }

    courseSelect.addEventListener('change', async (e) => {
        const courseId = e.target.value;
        if (!courseId) {
            assignSelect.innerHTML = '<option value="">-- Select Course First --</option>';
            assignSelect.disabled = true;
            return;
        }
        
        assignSelect.innerHTML = '<option value="">Loading...</option>';
        assignSelect.disabled = true;
        
        try {
            if (!courseworkCache[courseId]) {
                const cw = await classroom.fetchCourseWork(courseId);
                courseworkCache[courseId] = cw;
            }
            
            assignSelect.innerHTML = '<option value="">-- Select Assignment --</option><option value="NEW">Create New Assignment...</option>';
            courseworkCache[courseId].forEach(cw => {
                const opt = document.createElement('option');
                opt.value = cw.id;
                opt.textContent = cw.title;
                opt.dataset.title = cw.title;
                assignSelect.appendChild(opt);
            });
            assignSelect.disabled = false;
        } catch (error) {
            console.error("Failed to load coursework", error);
            assignSelect.innerHTML = '<option value="">Error loading</option>';
        }
    });

    assignSelect.addEventListener('change', (e) => {
        const selected = assignSelect.selectedOptions[0];
        if (selected && selected.value !== 'NEW' && selected.value !== '') {
            nameInput.value = selected.dataset.title || selected.textContent;
            renderGoalSelectors();
        }
        classroomScores = {};
        rebuildTable();
    });

    nameInput.addEventListener('input', () => {
        renderGoalSelectors();
    });

    function renderLearners() {
        learnerListEl.innerHTML = '';
        const learners = AppState.rootData?.Student || [];
        
        // Add "Select All"
        const selectAllDiv = document.createElement('div');
        selectAllDiv.style.display = 'flex';
        selectAllDiv.style.alignItems = 'center';
        selectAllDiv.style.gap = '8px';
        selectAllDiv.style.paddingBottom = '8px';
        selectAllDiv.style.borderBottom = '1px solid var(--border)';
        selectAllDiv.style.marginBottom = '8px';
        
        const selectAllCb = document.createElement('input');
        selectAllCb.type = 'checkbox';
        selectAllCb.id = 'evidence_select_all_learners';
        selectAllCb.checked = selectedLearnerIds.size > 0 && selectedLearnerIds.size === learners.length;
        selectAllCb.onchange = (e) => {
            if (e.target.checked) {
                learners.forEach(s => selectedLearnerIds.add(s.learnerDataId));
            } else {
                selectedLearnerIds.clear();
            }
            renderLearners(); // Re-render to update checkboxes
            rebuildTable();
        };
        
        const selectAllLabel = document.createElement('label');
        selectAllLabel.htmlFor = 'evidence_select_all_learners';
        selectAllLabel.textContent = 'Select All Learners';
        selectAllLabel.style.fontWeight = '600';
        selectAllLabel.style.cursor = 'pointer';
        
        selectAllDiv.appendChild(selectAllCb);
        selectAllDiv.appendChild(selectAllLabel);
        learnerListEl.appendChild(selectAllDiv);
        
        learners.forEach(s => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '8px';
            
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.id = `evidence_learner_${s.learnerDataId}`;
            cb.value = s.learnerDataId;
            cb.checked = selectedLearnerIds.has(s.learnerDataId);
            
            cb.onchange = (e) => {
                if (e.target.checked) selectedLearnerIds.add(s.learnerDataId);
                else selectedLearnerIds.delete(s.learnerDataId);
                rebuildTable();
                
                // Update select all checkbox state
                const allChecked = selectedLearnerIds.size === learners.length;
                document.getElementById('evidence_select_all_learners').checked = allChecked;
            };
            
            const lbl = document.createElement('label');
            lbl.htmlFor = cb.id;
            lbl.textContent = s.displayName || s.name;
            lbl.style.cursor = 'pointer';
            
            div.appendChild(cb);
            div.appendChild(lbl);
            learnerListEl.appendChild(div);
        });
        document.getElementById('evidence_form').classList.remove('hidden');
    }

    function createGoalCheckbox(comp) {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '6px';
        
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = `goal_cb_${Math.random().toString(36).substr(2, 9)}`;
        cb.dataset.goalId = comp.id;
        cb.checked = selectedGoalIds.has(comp.id);
        
        cb.onchange = (e) => {
            if (e.target.checked) selectedGoalIds.add(comp.id);
            else selectedGoalIds.delete(comp.id);
            
            // Sync all checkboxes for this goal
            document.querySelectorAll(`input[data-goal-id="${comp.id}"]`).forEach(input => {
                input.checked = e.target.checked;
            });
            rebuildTable();
        };
        
        const lbl = document.createElement('label');
        lbl.htmlFor = cb.id;
        lbl.textContent = comp.name;
        lbl.style.fontSize = '0.85rem';
        lbl.style.cursor = 'pointer';
        lbl.title = comp.description || '';
        
        div.appendChild(cb);
        div.appendChild(lbl);
        return div;
    }

    function renderGoalSelectors() {
        const evidenceName = nameInput.value.trim();
        const suggestedIds = new Set(evidenceName ? uiPrefs.getCompetenciesForAssignment(evidenceName) : []);
        const recentIds = new Set(uiPrefs.getRecentCompetencyIds());
        
        const comps = AppState.rootData?.Competency || [];
        const groups = AppState.rootData?.['Competency Group'] || [];
        
        // Populate Suggested
        suggestedList.innerHTML = '';
        if (suggestedIds.size > 0) {
            comps.filter(c => suggestedIds.has(c.id)).forEach(c => suggestedList.appendChild(createGoalCheckbox(c)));
            suggestedContainer.classList.remove('hidden');
        } else {
            suggestedContainer.classList.add('hidden');
        }
        
        // Populate Recent
        recentList.innerHTML = '';
        if (recentIds.size > 0) {
            comps.filter(c => recentIds.has(c.id)).forEach(c => recentList.appendChild(createGoalCheckbox(c)));
            recentContainer.classList.remove('hidden');
        } else {
            recentContainer.classList.add('hidden');
        }
        
        // Populate Filtered
        const selectedGroupId = getSelectedGroup();
        filteredList.innerHTML = '';
        if (selectedGroupId && selectedGroupId !== 'ALL' && selectedGroupId !== 'UNGROUPED') {
            const group = groups.find(g => g.id === selectedGroupId);
            if (group) {
                filteredTitle.textContent = `Competencies in: ${group.name}`;
                comps.filter(c => group.competencyIds.includes(c.id)).forEach(c => filteredList.appendChild(createGoalCheckbox(c)));
                filteredContainer.classList.remove('hidden');
            } else {
                filteredContainer.classList.add('hidden');
            }
        } else if (selectedGroupId === 'UNGROUPED') {
            filteredTitle.textContent = `Ungrouped Competencies`;
            comps.filter(c => !groups.some(g => g.competencyIds.includes(c.id))).forEach(c => filteredList.appendChild(createGoalCheckbox(c)));
            filteredContainer.classList.remove('hidden');
        } else {
            filteredContainer.classList.add('hidden');
        }
        
        // Populate All
        allList.innerHTML = '';
        const sortedComps = [...comps].sort((a,b) => a.name.localeCompare(b.name));
        sortedComps.forEach(c => allList.appendChild(createGoalCheckbox(c)));
    }

    function rebuildTable() {
        // Clear all th except first
        while (tableHeadRow.children.length > 1) {
            tableHeadRow.removeChild(tableHeadRow.lastChild);
        }
        
        const comps = AppState.rootData?.Competency || [];
        const selectedComps = Array.from(selectedGoalIds).map(id => comps.find(c => c.id === id)).filter(Boolean);
        
        if (assignSelect.value !== '') {
            const th = document.createElement('th');
            th.textContent = 'Score';
            th.title = 'Numeric grade for Google Classroom';
            th.style.padding = '8px';
            th.style.borderBottom = '1px solid var(--border)';
            th.style.textAlign = 'center';
            tableHeadRow.appendChild(th);
        }
        
        selectedComps.forEach(comp => {
            const th = document.createElement('th');
            th.textContent = comp.name;
            th.title = comp.description;
            th.style.padding = '8px';
            th.style.borderBottom = '1px solid var(--border)';
            th.style.textAlign = 'center';
            tableHeadRow.appendChild(th);
        });
        
        tbody.innerHTML = '';
        
        if (selectedLearnerIds.size === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = selectedGoalIds.size + 1;
            td.textContent = 'No learners selected.';
            td.style.padding = '12px';
            td.style.textAlign = 'center';
            td.style.color = 'var(--text-muted)';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        const learners = AppState.rootData?.Student || [];
        const selectedLearnersList = Array.from(selectedLearnerIds).map(id => learners.find(s => s.learnerDataId === id)).filter(Boolean);
        
        selectedLearnersList.forEach(learner => {
            if (!ratings[learner.learnerDataId]) ratings[learner.learnerDataId] = {};
            
            const tr = document.createElement('tr');
            const tdName = document.createElement('td');
            tdName.textContent = learner.displayName || learner.name;
            tdName.style.padding = '8px';
            tdName.style.borderBottom = '1px solid var(--border)';
            tdName.style.position = 'sticky';
            tdName.style.left = '0';
            tdName.style.background = 'var(--bg)';
            tdName.style.zIndex = '1';
            tdName.style.fontWeight = '500';
            tr.appendChild(tdName);
            
            if (assignSelect.value !== '') {
                const tdScore = document.createElement('td');
                tdScore.style.padding = '8px';
                tdScore.style.borderBottom = '1px solid var(--border)';
                tdScore.style.textAlign = 'center';
                
                const scoreInput = document.createElement('input');
                scoreInput.type = 'number';
                scoreInput.style.width = '60px';
                scoreInput.className = 'input-text';
                scoreInput.value = classroomScores[learner.learnerDataId] !== undefined ? classroomScores[learner.learnerDataId] : '';
                scoreInput.oninput = (e) => {
                    if (e.target.value === '') {
                        delete classroomScores[learner.learnerDataId];
                    } else {
                        classroomScores[learner.learnerDataId] = parseFloat(e.target.value);
                    }
                };
                
                tdScore.appendChild(scoreInput);
                tr.appendChild(tdScore);
            }
            
            selectedComps.forEach(comp => {
                const td = document.createElement('td');
                td.style.padding = '8px';
                td.style.borderBottom = '1px solid var(--border)';
                td.style.textAlign = 'center';
                td.style.minWidth = '120px';
                
                const btnContainer = document.createElement('div');
                btnContainer.style.display = 'flex';
                btnContainer.style.gap = '4px';
                btnContainer.style.justifyContent = 'center';
                
                const val = ratings[learner.learnerDataId][comp.id];
                
                const setRating = (lId, cId, v) => {
                    if (ratings[lId][cId] === v) {
                        delete ratings[lId][cId];
                    } else {
                        ratings[lId][cId] = v;
                    }
                    rebuildTable();
                };
                
                const createBtn = (label, v, color) => {
                    const btn = document.createElement('button');
                    btn.textContent = label;
                    btn.style.padding = '4px 8px';
                    btn.style.fontSize = '0.75rem';
                    btn.style.borderRadius = '4px';
                    btn.style.cursor = 'pointer';
                    btn.style.border = val === v ? `1px solid ${color}` : '1px solid var(--border)';
                    btn.style.background = val === v ? color : 'var(--bg)';
                    btn.style.color = val === v ? '#fff' : 'var(--text-main)';
                    btn.style.fontWeight = val === v ? '600' : '400';
                    btn.onclick = () => setRating(learner.learnerDataId, comp.id, v);
                    return btn;
                };
                
                btnContainer.appendChild(createBtn('Not Yet', 0.0, '#ef4444'));
                btnContainer.appendChild(createBtn('Developing', 0.5, '#f59e0b'));
                btnContainer.appendChild(createBtn('Demonstrates', 1.0, '#10b981'));
                
                td.appendChild(btnContainer);
                
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
    }

    // Refresh goal selectors when global filter changes
    const globalFilterEl = document.getElementById('competency-group-select');
    if (globalFilterEl) {
        globalFilterEl.addEventListener('change', () => {
            renderGoalSelectors();
        });
    }

    submitBtn.addEventListener('click', async () => {
        const evName = nameInput.value.trim();
        if (!evName) {
            alert("Evidence Name is required.");
            return;
        }
        
        if (selectedLearnerIds.size === 0) {
            alert("Select at least one learner.");
            return;
        }

        const files = Array.from(fileInput.files);
        const evidenceNote = noteInput.value.trim();
        const ts = new Date().toISOString();
        const authorEmail = uiPrefs.getUserEmail() || 'unknown@example.com';

        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving Evidence... (This may take a moment)';
        
        try {
            let courseId = courseSelect.value;
            let courseWorkId = assignSelect.value;
            
            if (courseId && courseWorkId === 'NEW') {
                const created = await classroom.createCourseWork(courseId, evName);
                courseWorkId = created.id;
                
                // Update select dropdown
                const opt = document.createElement('option');
                opt.value = courseWorkId;
                opt.textContent = evName;
                opt.dataset.title = evName;
                assignSelect.insertBefore(opt, assignSelect.options[1]);
                assignSelect.value = courseWorkId;
            }
            
            const learners = AppState.rootData?.Student || [];
            
            const promises = Array.from(selectedLearnerIds).map(async (learnerId) => {
                const evidence = {
                    id: `ev_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
                    name: evName,
                    note: evidenceNote,
                    timestamp: ts,
                    authorEmail: authorEmail
                };
                
                const observations = [];
                if (ratings[learnerId]) {
                    Object.keys(ratings[learnerId]).forEach(compId => {
                        observations.push({
                            id: `obs_${Math.random().toString(36).substr(2, 9)}`,
                            competencyId: compId,
                            authorEmail: authorEmail,
                            rating: ratings[learnerId][compId],
                            timestamp: ts
                        });
                    });
                }
                
                // Even if observations is empty, we can still add evidence (e.g. just a note/artifact)
                await storage.addEvidenceAndObservations(learnerId, evidence, observations, files);
                
                // Sync grade to classroom if applicable
                const score = classroomScores[learnerId];
                if (courseId && courseWorkId && score !== undefined) {
                    const learner = learners.find(s => s.learnerDataId === learnerId);
                    if (learner && learner.classroomId) {
                        try {
                            await classroom.syncStudentGrade(courseId, courseWorkId, learner.classroomId, score);
                        } catch (err) {
                            console.error(`Failed to sync grade for ${learner.name}:`, err);
                        }
                    }
                }
            });
            
            await Promise.all(promises);
            
            // Update uiPrefs for Recent/Assignment goals
            uiPrefs.recordCompetencyUsage(Array.from(selectedGoalIds), evName);
            
            alert('Batch evidence saved successfully!');
            
            // Reset form
            nameInput.value = '';
            noteInput.value = '';
            fileInput.value = '';
            selectedLearnerIds.clear();
            selectedGoalIds.clear();
            ratings = {};
            classroomScores = {};
            renderLearners();
            renderGoalSelectors();
            rebuildTable();
            
        } catch (e) {
            console.error(e);
            alert("Error saving batch evidence: " + e.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Evidence';
        }
    });

    // Initial load
    renderLearners();
    renderGoalSelectors();
    loadClassrooms();
}
