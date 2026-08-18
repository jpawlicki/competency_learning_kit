import { createElement, setElementContents } from './utils.js';
export function initEvidenceBatchUI(AppState, storage, classroom, uiPrefs) {
    const courseSelect = document.getElementById('evidence_classroom_selector');
    const assignSelect = document.getElementById('evidence_assignment_selector');
    const nameInput = document.getElementById('evidence_name');
    const learnerListEl = document.getElementById('evidence_learner_list');

    const compListEl = document.getElementById('evidence_comp_list');

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


    async function loadClassrooms() {
        try {
            courses = await classroom.fetchClassrooms();
            setElementContents(courseSelect, createElement('option', { value: '', textContent: '-- No Classroom Sync --' }));
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
            setElementContents(assignSelect, createElement('option', { value: '', textContent: '-- Select Course First --' }));
            assignSelect.disabled = true;
            return;
        }

        setElementContents(assignSelect, createElement('option', { value: '', textContent: 'Loading...' }));
        assignSelect.disabled = true;

        try {
            if (!courseworkCache[courseId]) {
                const cw = await classroom.fetchCourseWork(courseId);
                courseworkCache[courseId] = cw;
            }

            setElementContents(assignSelect, 
                createElement('option', { value: '', textContent: '-- Select Assignment --' }),
                createElement('option', { value: 'NEW', textContent: 'Create New Assignment...' })
            );
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
            setElementContents(assignSelect, createElement('option', { value: '', textContent: 'Error loading' }));
        }
    });

    assignSelect.addEventListener('change', (e) => {
        const selected = assignSelect.selectedOptions[0];
        if (selected && selected.value !== 'NEW' && selected.value !== '') {
            nameInput.value = selected.dataset.title || selected.textContent;
            renderCompetencies();
        }
        classroomScores = {};
        rebuildTable();
    });

    nameInput.addEventListener('input', () => {
        renderCompetencies();
    });

    learnerListEl.addEventListener('change', (e) => {
        if (!e.detail) return; // Ignore native checkbox change events bubbling up
        selectedLearnerIds = new Set(e.detail.selectedIds);
        rebuildTable();
    });

    compListEl.addEventListener('change', (e) => {
        if (!e.detail) return;
        selectedGoalIds = new Set(e.detail.selectedIds);
        rebuildTable();
    });

    function renderLearners() {
        const learners = AppState.rootData?.Student || [];
        const groups = AppState.rootData?.['Learner Group'] || [];
        learnerListEl.setLearners(learners, groups);
        document.getElementById('evidence_form').classList.remove('hidden');
    }

    function renderCompetencies() {
        const evidenceName = nameInput.value.trim();
        const suggestedIds = evidenceName ? uiPrefs.getCompetenciesForAssignment(evidenceName) : [];

        const comps = AppState.rootData?.Competency || [];
        const groups = AppState.rootData?.['Competency Group'] || [];

        compListEl.setCompetencies(comps, groups, suggestedIds);
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

        setElementContents(tbody);

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

                btnContainer.appendChild(createBtn('No', 0.0, '#ef4444'));
                btnContainer.appendChild(createBtn('Some', 0.5, '#f59e0b'));
                btnContainer.appendChild(createBtn('Yes', 1.0, '#10b981'));

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
            renderCompetencies();
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
                            evidenceId: evidence.id,
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
            learnerListEl.clearSelection();
            compListEl.clearSelection();
            selectedLearnerIds.clear();
            selectedGoalIds.clear();
            ratings = {};
            classroomScores = {};
            renderLearners();
            renderCompetencies();
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
    renderCompetencies();
    loadClassrooms();
}
