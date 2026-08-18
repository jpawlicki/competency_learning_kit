import { createStorageGoogleDrive, createUIPrefsBrowserStorage } from './data.js';
import { createGoogleClassroom } from './google_classroom.js';
import { initEvidenceBatchUI } from './evidence_batch.js';
import { initAssessmentsView } from './assessments.js';
import { initSetupReports } from './setup_reports.js';
import { initReportsView } from './reports.js';
import { createElement, setElementContents } from './utils.js';

const CLIENT_ID = '767614918217-040505l01huso2e5f42bavj5magf27p8.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.rosters.readonly https://www.googleapis.com/auth/classroom.coursework.students https://www.googleapis.com/auth/classroom.coursework.me';

const uiPrefs = createUIPrefsBrowserStorage();
const storage = createStorageGoogleDrive(uiPrefs);
const classroom = createGoogleClassroom(uiPrefs);
let tokenClient;

const AppState = {
    rootData: null,
    isLoaded: false,
    isLoading: false,
    loadPromise: null,
    async load() {
        if (this.isLoaded) return this.rootData;
        if (this.loadPromise) return this.loadPromise;
        if (!uiPrefs.getAccessToken()) return null;

        this.isLoading = true;
        const loader = document.getElementById('global-loading');
        if (loader) loader.classList.remove('hidden');

        this.loadPromise = storage.readRootData().then(data => {
            this.rootData = data;
            this.isLoaded = true;
            this.isLoading = false;
            if (loader) loader.classList.add('hidden');
            if (typeof populateGlobalFilter === 'function') {
                populateGlobalFilter(data['Competency Group'] || []);
            }
            return data;
        }).catch(e => {
            this.isLoading = false;
            this.loadPromise = null;
            if (loader) loader.classList.add('hidden');
            throw e;
        });
        return this.loadPromise;
    },
    invalidate() {
        this.rootData = null;
        this.isLoaded = false;
        this.loadPromise = null;
    }
};



document.addEventListener('DOMContentLoaded', () => {
    // --- Navigation Routing ---
    const navButtons = document.querySelectorAll('.nav-btn');
    const viewSections = document.querySelectorAll('.view-section');

    function switchView(targetId) {
        navButtons.forEach(btn => {
            if (btn.dataset.target === targetId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        viewSections.forEach(section => {
            if (section.id === targetId) {
                section.classList.remove('hidden');
                section.classList.add('active');
            } else {
                section.classList.add('hidden');
                section.classList.remove('active');
            }
        });

        if (targetId === 'view-admin') {
            document.querySelector('.filter-group')?.classList.add('invisible');
            const activeAdminTab = document.querySelector('.tab-btn[data-admin-tab="students"]');
            if (activeAdminTab && activeAdminTab.classList.contains('active')) {
                loadStudents();
            }
        } else {
            document.querySelector('.filter-group')?.classList.remove('invisible');
        }
    }

    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            if (target) {
                switchView(target);
            }
        });
    });


    // --- Inner Tabs Routing ---
    const allTabContainers = document.querySelectorAll('.tabs');
    allTabContainers.forEach(container => {
        const tabs = container.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                tabs.forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // If this is the Admin section tabs
                if (e.currentTarget.hasAttribute('data-admin-tab')) {
                    const targetTabId = e.currentTarget.dataset.adminTab;
                    document.querySelectorAll('.admin-tab-content').forEach(content => {
                        content.classList.add('hidden');
                        content.classList.remove('active');
                    });
                    const targetContent = document.getElementById(`admin-tab-${targetTabId}`);
                    if (targetContent) {
                        targetContent.classList.remove('hidden');
                        targetContent.classList.add('active');
                    }

                    if (targetTabId === 'students') {
                        loadStudents();
                    } else if (targetTabId === 'competencies') {
                        loadCompetencyArchitecture();
                    }
                }
            });
        });
    });


    // --- Authentication (Google Identity Services) ---
    const loginState = document.getElementById('login-state');
    const authRefreshOverlay = document.getElementById('auth-refresh-overlay');
    const topNav = document.querySelector('.top-nav');
    const setupWizard = document.getElementById('setup-wizard');

    if (setupWizard) {
        setupWizard.addEventListener('setup-complete', () => {
            updateSettingsUIState(true);
            AppState.invalidate();
            AppState.load().then(() => {
                initEvidenceBatchUI(AppState, storage, classroom, uiPrefs);
                initAssessmentsView(AppState, uiPrefs, storage);
                initSetupReports(AppState, storage);
                initReportsView(AppState, storage);
                const activeAdminTab = document.querySelector('.tab-btn[data-admin-tab="students"]');
                if (activeAdminTab && activeAdminTab.classList.contains('active') && !document.getElementById('view-admin').classList.contains('hidden')) {
                    loadStudents();
                }
            });
        });
    }

    window.gisLoaded = () => {
        tokenClient = uiPrefs.initTokenClient(google.accounts.oauth2, {
            clientId: CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    handleLoginSuccess();
                }
            },
        });

        // Auto-login if we have a token cached in sessionStorage
        if (uiPrefs.getAccessToken()) {
            handleLoginSuccess();
        } else {
            if (authRefreshOverlay) authRefreshOverlay.classList.remove('hidden');
            if (topNav) topNav.classList.add('auth-refresh-active');
        }
    };

    // Fallback: If the GIS script loaded before this module finished executing
    if (window.google && window.google.accounts) {
        window.gisLoaded();
    }

    loginState.addEventListener('login-requested', () => {
        if (!tokenClient) {
            alert('Google Identity Services failed to load. Please refresh the page.');
            return;
        }
        uiPrefs.requestAccessToken(tokenClient, { interactive: true });
    });

    loginState.addEventListener('logout-requested', () => {

        AppState.invalidate();
        uiPrefs.clearAccessToken();
        uiPrefs.clearUserEmail();
        uiPrefs.clearProjectComponentIds();

        loginState.setLoggedOut();
        if (authRefreshOverlay) authRefreshOverlay.classList.remove('hidden');
        if (topNav) topNav.classList.add('auth-refresh-active');

        // Reset Admin View
        setElementContents(document.getElementById('student_list'), createElement('li', { className: 'placeholder-text', textContent: 'Please sign in to view learners.' }));
    });

    async function handleLoginSuccess() {
        if (authRefreshOverlay) authRefreshOverlay.classList.add('hidden');
        if (topNav) topNav.classList.remove('auth-refresh-active');

        // Try to fetch the user's email from Drive API if we don't have it
        let email = uiPrefs.getUserEmail();
        if (!email) {
            try {
                const aboutInfo = await storage.driveRequest('/about?fields=user');
                if (aboutInfo && aboutInfo.user && aboutInfo.user.emailAddress) {
                    email = aboutInfo.user.emailAddress;
                    uiPrefs.setUserEmail(email);
                }
            } catch (e) {
                console.warn("Could not fetch user email", e);
            }
        }

        loginState.setLoggedIn(email);

        try {
            const components = await storage.resolveProjectComponents();
            if (components && components.rootDataId) {
                // connected

                updateSettingsUIState(true);

                AppState.invalidate();
                AppState.load().then(() => {
                    initEvidenceBatchUI(AppState, storage, classroom, uiPrefs);
                    initAssessmentsView(AppState, uiPrefs, storage);
                    initSetupReports(AppState, storage);
                    initReportsView(AppState, storage);
                    // If we are currently on the Admin -> Students tab, load the data
                    const activeAdminTab = document.querySelector('.tab-btn[data-admin-tab="students"]');
                    if (activeAdminTab && activeAdminTab.classList.contains('active') && !document.getElementById('view-admin').classList.contains('hidden')) {
                        loadStudents();
                    }
                });
            } else {
                // project not found
                updateSettingsUIState(false);
                if (setupWizard) {
                    setupWizard.start(storage);
                }
            }
        } catch (e) {
            console.warn("Project resolution failed", e);
            // disconnected
            updateSettingsUIState(false);
        }
    }

    window.addEventListener('clk-auth-error', () => {
        loginState.setAuthError();
        if (authRefreshOverlay) authRefreshOverlay.classList.remove('hidden');
        if (topNav) topNav.classList.add('auth-refresh-active');
    });


    // --- Admin: Students Management ---
    let allLearners = [];
    let archLearnerGroups = [];
    let selectedLearnerGroupId = 'ALL';

    const btnAddStudent = document.getElementById('add_student_btn');
    const newStudentInput = document.getElementById('new_student_name');
    const studentListEl = document.getElementById('student_list');
    const studentsLoadingEl = document.getElementById('students_loading');
    const btnAddLearnerGroup = document.getElementById('add_learner_group_btn');
    const learnerGroupEditForm = document.getElementById('learner_group_edit_form');
    const learnerGroupFormTitle = document.getElementById('learner_group_form_title');
    const learnerGroupIdInput = document.getElementById('learner_group_id');
    const learnerGroupNameInput = document.getElementById('learner_group_name');
    const learnerGroupDescInput = document.getElementById('learner_group_desc');
    const btnSaveLearnerGroup = document.getElementById('save_learner_group_btn');
    const btnCancelLearnerGroup = document.getElementById('cancel_learner_group_btn');

    const learnerGroupsListEl = document.getElementById('learner_groups_list');
    const learnerGroupCheckboxesEl = document.getElementById('learner_group_checkboxes');
    const btnToggleAddLearner = document.getElementById('toggle_add_learner_btn');
    const btnCancelAddLearner = document.getElementById('cancel_add_learner_btn');
    const addLearnerSection = document.getElementById('add_learner_section');

    if (btnToggleAddLearner) {
        btnToggleAddLearner.addEventListener('click', () => {
            addLearnerSection.classList.remove('hidden');
            btnToggleAddLearner.classList.add('hidden');
        });
    }

    if (btnCancelAddLearner) {
        btnCancelAddLearner.addEventListener('click', () => {
            addLearnerSection.classList.add('hidden');
            btnToggleAddLearner.classList.remove('hidden');
            newStudentInput.value = '';
            if (learnerGroupCheckboxesEl) {
                learnerGroupCheckboxesEl.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            }
        });
    }

    newStudentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnAddStudent.click();
        }
    });

    async function loadStudents() {
        if (!uiPrefs.getAccessToken()) {
            setElementContents(studentListEl, createElement('li', { className: 'placeholder-text', textContent: 'Please sign in to view learners.' }));
            return;
        }

        // Only show full loading state if list is empty
        if (studentListEl.children.length === 0 || studentListEl.querySelector('.placeholder-text')) {
            studentsLoadingEl.classList.remove('hidden');
            setElementContents(studentListEl);
        }

        try {
            const rootData = await AppState.load();
            studentsLoadingEl.classList.add('hidden');

            if (rootData) {
                allLearners = rootData.Student || [];
                archLearnerGroups = rootData['Learner Group'] || [];

                if (selectedLearnerGroupId === null && archLearnerGroups.length > 0) {
                    // Check if there are ungrouped learners
                    const hasUngrouped = allLearners.some(l => !l.groupIds || l.groupIds.length === 0);
                    if (!hasUngrouped) selectedLearnerGroupId = 'ALL';
                }

                renderLearnerGroups(archLearnerGroups);
                renderStudentList();
            }
        } catch (error) {
            console.error("Failed to load students:", error);
            studentsLoadingEl.classList.add('hidden');
            setElementContents(studentListEl, createElement('li', {
                className: 'placeholder-text',
                style: 'color: var(--error-text);',
                textContent: `Error loading learners: ${error.message}`
            }));
        }
    }

    function renderLearnerGroups(groups) {
        setElementContents(learnerGroupsListEl);
        setElementContents(learnerGroupCheckboxesEl);

        const hasUngroupedLearners = allLearners.some(l => !l.groupIds || l.groupIds.length === 0);

        // Add "All Learners" pseudo-group
        const allLi = document.createElement('li');
        allLi.textContent = 'All Learners';
        allLi.className = 'group-list-item' + (selectedLearnerGroupId === 'ALL' ? ' selected' : '');
        allLi.onclick = () => { selectedLearnerGroupId = 'ALL'; renderLearnerGroups(archLearnerGroups); renderStudentList(); };
        learnerGroupsListEl.appendChild(allLi);

        // Add "Ungrouped" pseudo-group
        if (hasUngroupedLearners) {
            const unLi = document.createElement('li');
            unLi.textContent = 'Ungrouped';
            unLi.className = 'group-list-item' + (selectedLearnerGroupId === null ? ' selected' : '');
            unLi.onclick = () => { selectedLearnerGroupId = null; renderLearnerGroups(archLearnerGroups); renderStudentList(); };
            learnerGroupsListEl.appendChild(unLi);
        } else if (selectedLearnerGroupId === null) {
            selectedLearnerGroupId = 'ALL';
            renderLearnerGroups(archLearnerGroups);
            renderStudentList();
            return;
        }

        if (groups.length === 0) {
            setElementContents(learnerGroupCheckboxesEl, createElement('div', { className: 'placeholder-text', style: 'font-size: 0.8rem;', textContent: 'No groups available.' }));
            return;
        }

        groups.sort((a, b) => a.name.localeCompare(b.name)).forEach(group => {
            // Render list item
            const li = document.createElement('li');
            li.className = 'group-list-item' + (selectedLearnerGroupId === group.id ? ' selected' : '');

            const nameSpan = document.createElement('span');
            nameSpan.textContent = group.name;

            li.appendChild(nameSpan);

            const editBtn = document.createElement('button');
            editBtn.className = 'material-symbols-outlined btn-icon';
            editBtn.textContent = 'edit';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                openLearnerGroupForm(group);
            };
            li.appendChild(editBtn);

            li.onclick = () => { selectedLearnerGroupId = group.id; renderLearnerGroups(archLearnerGroups); renderStudentList(); };

            learnerGroupsListEl.appendChild(li);

            // Render checkbox
            const cbLabel = document.createElement('label');
            cbLabel.className = 'checkbox-label';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = group.id;

            cbLabel.appendChild(cb);
            cbLabel.appendChild(document.createTextNode(group.name));
            learnerGroupCheckboxesEl.appendChild(cbLabel);
        });
    }

    function openLearnerGroupForm(group = null) {
        if (group) {
            learnerGroupFormTitle.textContent = 'Edit Group';
            learnerGroupIdInput.value = group.id;
            learnerGroupNameInput.value = group.name;
            learnerGroupDescInput.value = group.description || '';
        } else {
            learnerGroupFormTitle.textContent = 'New Group';
            learnerGroupIdInput.value = '';
            learnerGroupNameInput.value = '';
            learnerGroupDescInput.value = '';
        }
        learnerGroupEditForm.classList.remove('hidden');
        btnAddLearnerGroup.classList.add('hidden');
    }

    function closeLearnerGroupForm() {
        learnerGroupEditForm.classList.add('hidden');
        btnAddLearnerGroup.classList.remove('hidden');
    }

    if (btnAddLearnerGroup) {
        btnAddLearnerGroup.addEventListener('click', () => {
            openLearnerGroupForm();
        });
    }

    if (btnCancelLearnerGroup) {
        btnCancelLearnerGroup.addEventListener('click', closeLearnerGroupForm);
    }

    if (btnSaveLearnerGroup) {
        btnSaveLearnerGroup.addEventListener('click', async () => {
            const name = learnerGroupNameInput.value.trim();
            const desc = learnerGroupDescInput.value.trim();
            const id = learnerGroupIdInput.value;

            if (!name) {
                alert("Group name is required.");
                return;
            }

            btnSaveLearnerGroup.disabled = true;
            btnSaveLearnerGroup.textContent = 'Saving...';

            try {
                // Update local array
                if (id) {
                    const idx = archLearnerGroups.findIndex(g => g.id === id);
                    if (idx > -1) {
                        archLearnerGroups[idx].name = name;
                        archLearnerGroups[idx].description = desc;
                    }
                } else {
                    const newId = 'lg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                    archLearnerGroups.push({ id: newId, name, description: desc });
                }

                await storage.updateLearnerGroups(archLearnerGroups);
                AppState.invalidate();
                await loadStudents();
                closeLearnerGroupForm();
            } catch (e) {
                alert("Failed to save group: " + e.message);
            } finally {
                btnSaveLearnerGroup.disabled = false;
                btnSaveLearnerGroup.textContent = 'Save';
            }
        });
    }

    function renderStudentList() {
        setElementContents(studentListEl);

        let filteredLearners = [];
        if (selectedLearnerGroupId === 'ALL') {
            filteredLearners = allLearners;
        } else if (selectedLearnerGroupId === null) {
            filteredLearners = allLearners.filter(l => !l.groupIds || l.groupIds.length === 0);
        } else {
            filteredLearners = allLearners.filter(l => l.groupIds && l.groupIds.includes(selectedLearnerGroupId));
        }

        if (filteredLearners.length === 0) {
            setElementContents(studentListEl, createElement('li', { className: 'placeholder-text', textContent: 'No learners found in this view.' }));
            return;
        }

        filteredLearners.sort((a, b) => a.name.localeCompare(b.name)).forEach(student => {
            const li = document.createElement('li');
            li.className = 'list-card';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = student.name;
            nameSpan.style.fontWeight = '500';

            const btnGroup = document.createElement('div');
            btnGroup.className = 'flex-row gap-sm';

            const delBtn = document.createElement('button');
            delBtn.textContent = 'Delete';
            delBtn.className = 'btn-danger btn-sm';

            delBtn.addEventListener('click', async () => {
                if (confirm(`Are you sure you want to delete ${student.name}? This will delete their folder in Drive.`)) {
                    delBtn.disabled = true;
                    delBtn.textContent = 'Deleting...';
                    try {
                        await storage.deleteLearner(student.name);
                        AppState.invalidate();
                        loadStudents(); // Reload list
                    } catch (e) {
                        alert('Error deleting learner: ' + e.message);
                        delBtn.disabled = false;
                        delBtn.textContent = 'Delete';
                    }
                }
            });

            btnGroup.appendChild(delBtn);
            li.appendChild(nameSpan);
            li.appendChild(btnGroup);
            studentListEl.appendChild(li);
        });
    }

    btnAddStudent.addEventListener('click', async () => {
        const inputVal = newStudentInput.value.trim();
        if (!inputVal) return;

        const names = inputVal.split(',').map(n => n.trim()).filter(Boolean);
        if (names.length === 0) return;

        // Collect checked groups
        const selectedGroupIds = Array.from(learnerGroupCheckboxesEl.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

        // --- Optimistic UI ---
        newStudentInput.value = '';
        if (studentListEl.querySelector('.placeholder-text')) {
            setElementContents(studentListEl);
        }

        const optimisticLis = [];
        for (const name of names) {
            const optimisticLi = document.createElement('li');
            optimisticLi.style.display = 'flex';
            optimisticLi.style.justifyContent = 'space-between';
            optimisticLi.style.alignItems = 'center';
            optimisticLi.style.padding = '0.75rem';
            optimisticLi.style.border = '1px solid var(--border)';
            optimisticLi.style.borderRadius = 'var(--radius-md)';
            optimisticLi.style.background = 'var(--surface)';
            optimisticLi.style.opacity = '0.7';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = name;
            nameSpan.style.fontWeight = '500';

            const statusSpan = document.createElement('span');
            statusSpan.textContent = 'Adding...';
            statusSpan.style.fontSize = '0.8rem';
            statusSpan.style.color = 'var(--text-muted)';

            optimisticLi.appendChild(nameSpan);
            optimisticLi.appendChild(statusSpan);

            // Insert in alphabetical order
            const items = Array.from(studentListEl.children);
            let inserted = false;
            for (let i = 0; i < items.length; i++) {
                const span = items[i].querySelector('span');
                const currentName = span ? span.textContent : '';
                if (name.localeCompare(currentName) < 0) {
                    studentListEl.insertBefore(optimisticLi, items[i]);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) {
                studentListEl.appendChild(optimisticLi);
            }
            optimisticLis.push(optimisticLi);
        }

        try {
            await Promise.all(names.map(name => storage.addLearner(name, '', '', selectedGroupIds)));
            AppState.invalidate();
            await loadStudents();
            // Clear checkboxes
            learnerGroupCheckboxesEl.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            // Hide form
            addLearnerSection.classList.add('hidden');
            btnToggleAddLearner.classList.remove('hidden');
        } catch (error) {
            console.error("Failed to add student(s):", error);
            alert("Error adding learner(s): " + error.message);
            optimisticLis.forEach(li => li.remove());
        }
    });

    // --- Google Classroom Integration ---
    const btnLoadClassrooms = document.getElementById('load_classrooms_btn');
    const selectClassroom = document.getElementById('classroom_select');
    const containerClassroomSelect = document.getElementById('classroom_select_container');
    const btnImportClassroom = document.getElementById('import_classroom_btn');

    btnLoadClassrooms.addEventListener('click', async () => {
        if (!uiPrefs.getAccessToken()) {
            alert("Please sign in first.");
            return;
        }

        btnLoadClassrooms.disabled = true;
        btnLoadClassrooms.textContent = 'Loading...';

        try {
            const courses = await classroom.fetchClassrooms();
            setElementContents(selectClassroom, createElement('option', { value: '', textContent: 'Choose a course...' }));

            if (courses.length === 0) {
                alert("No active Google Classroom courses found.");
                return;
            }

            courses.forEach(course => {
                const opt = document.createElement('option');
                opt.value = course.id;
                opt.textContent = course.name;
                selectClassroom.appendChild(opt);
            });

            btnLoadClassrooms.classList.add('hidden');
            containerClassroomSelect.classList.remove('hidden');
        } catch (error) {
            console.error("Failed to fetch classrooms:", error);
            alert("Error fetching classrooms: " + error.message);
        } finally {
            btnLoadClassrooms.disabled = false;
            btnLoadClassrooms.textContent = 'Load Courses';
        }
    });

    btnImportClassroom.addEventListener('click', async () => {
        const courseId = selectClassroom.value;
        if (!courseId) {
            alert("Please select a course first.");
            return;
        }

        btnImportClassroom.disabled = true;
        btnImportClassroom.textContent = 'Importing...';

        try {
            // First ensure we have the latest students cached
            const rootData = await AppState.load();
            const existingStudents = rootData?.Student || [];

            const { importedCount, skippedCount } = await classroom.importStudentsFromClassrooms([courseId], existingStudents, storage);

            alert(`Import complete! Imported ${importedCount} new learners. Skipped/Linked ${skippedCount} existing learners.`);
            AppState.invalidate();
            await loadStudents();
        } catch (error) {
            console.error("Failed to import learners:", error);
            alert("Error importing learners: " + error.message);
        } finally {
            btnImportClassroom.disabled = false;
            btnImportClassroom.textContent = 'Import Learners';
        }
    });


    // --- Admin: Project Settings ---
    const btnInitProject = document.getElementById('init_project_btn');
    const inputInstitutionName = document.getElementById('institution_name');
    const btnDeleteProject = document.getElementById('delete_project_btn');
    const settingsTitle = document.getElementById('settings_title');
    const settingsDesc = document.getElementById('settings_desc');
    let isProjectConnected = false;

    async function updateSettingsUIState(connected) {
        isProjectConnected = connected;
        if (connected) {
            settingsTitle.textContent = 'Institution Settings';
            settingsDesc.textContent = 'Update your institution name for the project.';
            btnInitProject.textContent = 'Update Name';

            try {
                const data = await AppState.load();
                if (data && data['Institution Name']) {
                    inputInstitutionName.value = data['Institution Name'];
                }
            } catch (e) {
                console.warn("Could not load institution name:", e);
            }
        } else {
            settingsTitle.textContent = 'Project Initialization';
            settingsDesc.textContent = 'Connect your Google Drive to manage the "Competency Learning Kit Data" folder. If you haven\'t set up the project yet, enter your institution name and initialize it.';
            btnInitProject.textContent = 'Initialize Project';
            inputInstitutionName.value = '';
        }
    }

    btnInitProject.addEventListener('click', async () => {
        if (!uiPrefs.getAccessToken()) {
            alert("Please sign in first.");
            return;
        }

        const institutionName = inputInstitutionName.value.trim();
        btnInitProject.disabled = true;

        if (isProjectConnected) {
            btnInitProject.textContent = 'Updating...';
            try {
                await storage.updateInstitutionName(institutionName);
                alert("Institution name updated successfully in Google Drive.");
                AppState.invalidate();
            } catch (error) {
                console.error("Failed to update project name:", error);
                alert("Error updating project name: " + error.message);
            } finally {
                btnInitProject.disabled = false;
                btnInitProject.textContent = 'Update Name';
            }
        } else {
            btnInitProject.textContent = 'Initializing...';
            try {
                await storage.initializeData(institutionName);
                alert("Project initialized successfully in Google Drive.");
                // connected
                AppState.invalidate();
                updateSettingsUIState(true);

                // Reload students if that tab happens to be active
                const activeAdminTab = document.querySelector('.tab-btn[data-admin-tab="students"]');
                if (activeAdminTab && activeAdminTab.classList.contains('active')) {
                    AppState.load().then(() => loadStudents());
                }
            } catch (error) {
                console.error("Failed to initialize project:", error);
                alert("Error initializing project: " + error.message);
                btnInitProject.textContent = 'Initialize Project';
            } finally {
                btnInitProject.disabled = false;
            }
        }
    });

    btnDeleteProject.addEventListener('click', async () => {
        if (!uiPrefs.getAccessToken()) {
            alert("Please sign in first.");
            return;
        }

        if (confirm("DANGER: Are you absolutely sure you want to permanently delete the entire 'Competency Learning Kit Data' folder and ALL student records from Google Drive? This cannot be undone.")) {
            btnDeleteProject.disabled = true;
            btnDeleteProject.textContent = 'Deleting...';

            try {
                await storage.deleteProject();
                AppState.invalidate();
                alert("Project deleted successfully.");
                // project not found
                setElementContents(studentListEl, createElement('li', { className: 'placeholder-text', textContent: 'No learners found.' }));
            } catch (error) {
                console.error("Failed to delete project:", error);
                alert("Error deleting project: " + error.message);
            } finally {
                btnDeleteProject.disabled = false;
                btnDeleteProject.textContent = 'Delete Entire Project';
            }
        }
    });


    // --- Admin: Competency Architecture ---
    let archGroups = [];
    let archCompetencies = [];
    let selectedGroupId = null; // null means 'Ungrouped', 'ALL' means all, otherwise group ID

    const archLoadingEl = document.getElementById('competencies_loading');
    const groupsListEl = document.getElementById('competency_groups_list');
    const compListEl = document.getElementById('competency_list');
    const compListContainer = document.getElementById('competency_list_container');

    // Group Form
    const groupEditForm = document.getElementById('group_edit_form');
    const groupNameInput = document.getElementById('group_name');
    const groupDescInput = document.getElementById('group_desc');
    const groupIdInput = document.getElementById('group_id');
    const groupFormTitle = document.getElementById('group_form_title');

    // Competency Form
    const compEditForm = document.getElementById('competency_edit_form');
    const compIdInput = document.getElementById('comp_id');
    const compNameInput = document.getElementById('comp_name');
    const compDescInput = document.getElementById('comp_desc');
    const compColorInput = document.getElementById('comp_color');
    const compColorSwatches = document.getElementById('comp_color_swatches');
    const compGroupsSelect = document.getElementById('comp_groups');
    const compRelatedSelect = document.getElementById('comp_related');
    const compFormTitle = document.getElementById('comp_form_title');

    async function loadCompetencyArchitecture() {
        if (!uiPrefs.getAccessToken()) return;

        try {
            const rootData = await AppState.load();
            // Work with a fresh reference so we can mutate safely before saving
            archGroups = rootData['Competency Group'] || [];
            archCompetencies = rootData['Competency'] || [];

            // Set default view to ALL if nothing selected
            if (selectedGroupId === null && archGroups.length > 0) {
                const hasUngrouped = archCompetencies.some(c => !archGroups.some(g => g.competencyIds.includes(c.id)));
                if (!hasUngrouped) selectedGroupId = 'ALL';
            }

            renderGroupsList();
            renderCompetenciesList();
        } catch (e) {
            console.error(e);
        }
    }

    function renderGroupsList() {
        setElementContents(groupsListEl);

        // Add "All Competencies" pseudo-group
        const allLi = document.createElement('li');
        allLi.textContent = 'All Competencies';
        allLi.className = 'group-list-item' + (selectedGroupId === 'ALL' ? ' selected' : '');
        allLi.onclick = () => { selectedGroupId = 'ALL'; renderGroupsList(); renderCompetenciesList(); hideForms(); };
        groupsListEl.appendChild(allLi);

        // Add "Ungrouped" pseudo-group
        const hasUngroupedComps = archCompetencies.some(c => !archGroups.some(g => g.competencyIds.includes(c.id)));
        if (hasUngroupedComps) {
            const unLi = document.createElement('li');
            unLi.textContent = 'Ungrouped';
            unLi.className = 'group-list-item' + (selectedGroupId === null ? ' selected' : '');
            unLi.onclick = () => { selectedGroupId = null; renderGroupsList(); renderCompetenciesList(); hideForms(); };
            groupsListEl.appendChild(unLi);
        } else if (selectedGroupId === null) {
            // fallback if empty
            selectedGroupId = 'ALL';
            renderGroupsList();
            renderCompetenciesList();
            hideForms();
            return;
        }

        archGroups.forEach(g => {
            const li = document.createElement('li');
            li.className = 'group-list-item' + (selectedGroupId === g.id ? ' selected' : '');

            const nameSpan = document.createElement('span');
            nameSpan.textContent = g.name;
            li.appendChild(nameSpan);

            // Edit group btn
            const editBtn = document.createElement('button');
            editBtn.className = 'material-symbols-outlined btn-icon';
            editBtn.textContent = 'edit';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                openGroupForm(g);
            };
            li.appendChild(editBtn);

            li.onclick = () => { selectedGroupId = g.id; renderGroupsList(); renderCompetenciesList(); hideForms(); };
            groupsListEl.appendChild(li);
        });
    }

    function hideForms() {
        groupEditForm.classList.add('hidden');
        compEditForm.classList.add('hidden');
        compListContainer.classList.remove('hidden');
    }

    function renderCompetenciesList() {
        setElementContents(compListEl);
        document.getElementById('add_competency_btn').classList.remove('hidden');

        let filteredComps = [];
        if (selectedGroupId === 'ALL') {
            document.getElementById('detail_group_title').textContent = 'All Competencies';
            filteredComps = archCompetencies;
        } else if (selectedGroupId === null) {
            document.getElementById('detail_group_title').textContent = 'Ungrouped Competencies';
            filteredComps = archCompetencies.filter(c => {
                return !archGroups.some(g => g.competencyIds.includes(c.id));
            });
        } else {
            const group = archGroups.find(g => g.id === selectedGroupId);
            document.getElementById('detail_group_title').textContent = group ? group.name : 'Competencies';
            filteredComps = archCompetencies.filter(c => group && group.competencyIds.includes(c.id));
        }

        if (filteredComps.length === 0) {
            setElementContents(compListEl, createElement('li', { className: 'placeholder-text', textContent: 'No competencies found in this view.' }));
            return;
        }

        filteredComps.forEach(c => {
            const li = document.createElement('li');
            li.className = 'list-card';
            li.style.borderLeft = `4px solid ${c.color}`;

            const infoDiv = document.createElement('div');
            setElementContents(infoDiv,
                createElement('strong', {
                    style: c.state === 'RETIRED' ? 'text-decoration: line-through; opacity: 0.5;' : '',
                    textContent: c.name
                }),
                createElement('br'),
                createElement('span', {
                    style: 'font-size: 0.8rem; color: var(--text-muted);',
                    textContent: c.description || ''
                })
            );

            const editBtn = document.createElement('button');
            editBtn.className = 'material-symbols-outlined btn-icon';
            editBtn.textContent = 'edit';
            editBtn.onclick = () => openCompForm(c);

            li.appendChild(infoDiv);
            li.appendChild(editBtn);
            compListEl.appendChild(li);
        });
    }

    // Group Form Logic
    document.getElementById('add_group_btn').addEventListener('click', () => {
        openGroupForm(null);
    });

    function openGroupForm(group) {
        groupEditForm.classList.remove('hidden');
        if (group) {
            groupFormTitle.textContent = 'Edit Group';
            groupIdInput.value = group.id;
            groupNameInput.value = group.name;
            groupDescInput.value = group.description;
        } else {
            groupFormTitle.textContent = 'New Group';
            groupIdInput.value = '';
            groupNameInput.value = '';
            groupDescInput.value = '';
        }
    }

    document.getElementById('cancel_group_btn').addEventListener('click', () => {
        groupEditForm.classList.add('hidden');
    });

    document.getElementById('save_group_btn').addEventListener('click', async () => {
        const id = groupIdInput.value || `group_${Date.now()}`;
        const name = groupNameInput.value.trim();
        if (!name) return alert('Name is required');

        let existing = archGroups.find(g => g.id === id);
        if (existing) {
            existing.name = name;
            existing.description = groupDescInput.value;
        } else {
            archGroups.push({
                id,
                name,
                description: groupDescInput.value,
                competencyIds: []
            });
        }

        groupEditForm.classList.add('hidden');
        renderGroupsList();
        await saveArchitecture();
    });

    // Competency Form Logic
    document.getElementById('add_competency_btn').addEventListener('click', () => {
        openCompForm(null);
    });

    function populateMultiSelect(selectEl, items, selectedIds) {
        setElementContents(selectEl);
        items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = item.name;
            if (selectedIds && selectedIds.includes(item.id)) opt.selected = true;
            selectEl.appendChild(opt);
        });
    }

    function openCompForm(comp) {
        compEditForm.classList.remove('hidden');
        compListContainer.classList.add('hidden');

        populateMultiSelect(compRelatedSelect, archCompetencies.filter(c => !comp || c.id !== comp.id), comp ? comp.relatedIds : []);

        const myGroups = comp ? archGroups.filter(g => g.competencyIds.includes(comp.id)).map(g => g.id) : (selectedGroupId && selectedGroupId !== 'ALL' ? [selectedGroupId] : []);
        populateMultiSelect(compGroupsSelect, archGroups, myGroups);

        if (compColorSwatches) {
            setElementContents(compColorSwatches);
            const uniqueColors = [...new Set(archCompetencies.map(c => c.color).filter(c => c))];
            if (uniqueColors.length === 0) {
                uniqueColors.push('#94a3b8', '#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa');
            }
            uniqueColors.forEach(color => {
                const swatch = document.createElement('div');
                swatch.style.width = '24px';
                swatch.style.height = '24px';
                swatch.style.borderRadius = '50%';
                swatch.style.backgroundColor = color;
                swatch.style.cursor = 'pointer';
                swatch.style.border = '1px solid var(--border)';
                swatch.title = color;
                swatch.addEventListener('click', () => {
                    compColorInput.value = color;
                });
                compColorSwatches.appendChild(swatch);
            });
        }

        if (comp) {
            compFormTitle.textContent = 'Edit Competency';
            compIdInput.value = comp.id;
            compNameInput.value = comp.name;
            compDescInput.value = comp.description;
            compColorInput.value = comp.color || '#94a3b8';
        } else {
            compFormTitle.textContent = 'New Competency';
            compIdInput.value = '';
            compNameInput.value = '';
            compDescInput.value = '';
            compColorInput.value = '#94a3b8';
        }
    }

    document.getElementById('cancel_comp_btn').addEventListener('click', () => {
        hideForms();
    });

    document.getElementById('save_comp_btn').addEventListener('click', async () => {
        const id = compIdInput.value || `comp_${Date.now()}`;
        const name = compNameInput.value.trim();
        if (!name) return alert('Name is required');

        const relatedIds = Array.from(compRelatedSelect.selectedOptions).map(o => o.value);
        const selectedGroups = Array.from(compGroupsSelect.selectedOptions).map(o => o.value);

        let existing = archCompetencies.find(c => c.id === id);
        if (existing) {
            existing.name = name;
            existing.description = compDescInput.value;
            existing.color = compColorInput.value;
            existing.relatedIds = relatedIds;
        } else {
            archCompetencies.push({
                id,
                name,
                description: compDescInput.value,
                color: compColorInput.value,
                relatedIds,
                state: 'ACTIVE',
                rank: 0,
                rubric: ''
            });
        }

        archGroups.forEach(g => {
            const hasComp = g.competencyIds.includes(id);
            const shouldHave = selectedGroups.includes(g.id);
            if (shouldHave && !hasComp) {
                g.competencyIds.push(id);
            } else if (!shouldHave && hasComp) {
                g.competencyIds = g.competencyIds.filter(cid => cid !== id);
            }
        });

        hideForms();
        renderGroupsList();
        renderCompetenciesList();
        await saveArchitecture();
    });

    async function saveArchitecture() {
        archLoadingEl.classList.remove('hidden');
        try {
            await storage.saveCompetencyArchitecture(archCompetencies, archGroups);
            AppState.invalidate();
            await AppState.load();
        } catch (e) {
            console.error("Failed to save architecture", e);
            alert("Error saving architecture: " + e.message);
        } finally {
            archLoadingEl.classList.add('hidden');
        }
    }
});
