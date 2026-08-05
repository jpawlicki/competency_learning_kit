export class LearnerSelector extends HTMLElement {
    constructor() {
        super();
        this.learners = [];
        this.groups = [];
        this.selectedLearnerIds = new Set();
    }
    
    connectedCallback() {
        if (!this.rendered) {
            this.render();
            this.rendered = true;
        }
    }
    
    setLearners(learners, groups) {
        this.learners = learners || [];
        this.groups = groups || [];
        
        // Preserve selected IDs that are still valid
        const validIds = new Set(this.learners.map(l => l.learnerDataId));
        const newSelected = new Set();
        for (const id of this.selectedLearnerIds) {
            if (validIds.has(id)) newSelected.add(id);
        }
        this.selectedLearnerIds = newSelected;
        
        this.render();
    }

    getSelectedLearners() {
        return Array.from(this.selectedLearnerIds);
    }
    
    clearSelection() {
        this.selectedLearnerIds.clear();
        this.render();
        this.dispatchEvent(new CustomEvent('change', { detail: { selectedIds: this.getSelectedLearners() } }));
    }

    toggleLearner(id, isSelected) {
        if (isSelected) {
            this.selectedLearnerIds.add(id);
        } else {
            this.selectedLearnerIds.delete(id);
        }
        
        // Sync checkboxes in DOM across all group instances
        const checkboxes = this.querySelectorAll(`input.learner-cb[value="${id}"]`);
        checkboxes.forEach(cb => cb.checked = isSelected);

        this.syncGroupSelectAll();
        
        this.dispatchEvent(new CustomEvent('change', { detail: { selectedIds: this.getSelectedLearners() } }));
    }
    
    toggleGroup(groupId, isSelected) {
        const cbs = this.querySelectorAll(`input.learner-cb[data-group="${groupId}"]`);
        
        cbs.forEach(cb => {
            const id = cb.value;
            if (isSelected) {
                this.selectedLearnerIds.add(id);
            } else {
                this.selectedLearnerIds.delete(id);
            }
        });
        
        // Sync all learner checkboxes globally since learners can be in multiple groups
        const allLearnerCbs = this.querySelectorAll('input.learner-cb');
        allLearnerCbs.forEach(cb => {
            cb.checked = this.selectedLearnerIds.has(cb.value);
        });
        
        this.syncGroupSelectAll();
        this.dispatchEvent(new CustomEvent('change', { detail: { selectedIds: this.getSelectedLearners() } }));
    }

    syncGroupSelectAll() {
        const groupCbs = this.querySelectorAll('.group-cb');
        groupCbs.forEach(gCb => {
            const groupId = gCb.dataset.group;
            const cbs = Array.from(this.querySelectorAll(`input.learner-cb[data-group="${groupId}"]`));
            if (cbs.length > 0) {
                gCb.checked = cbs.every(cb => cb.checked);
            } else {
                gCb.checked = false;
            }
        });
    }

    render() {
        this.innerHTML = '';
        
        if (this.learners.length === 0) {
            this.innerHTML = '<div class="placeholder-text" style="font-size: 0.9rem;">No learners found.</div>';
            return;
        }

        const learnersByGroup = {};
        const ungroupedLearners = [];

        this.groups.forEach(g => {
            learnersByGroup[g.id] = { name: g.name, learners: [] };
        });

        this.learners.forEach(l => {
            if (!l.groupIds || l.groupIds.length === 0) {
                ungroupedLearners.push(l);
            } else {
                // If a learner has group IDs that no longer exist, we could add them to ungrouped,
                // but let's strictly check.
                let addedToGroup = false;
                l.groupIds.forEach(gid => {
                    if (learnersByGroup[gid]) {
                        learnersByGroup[gid].learners.push(l);
                        addedToGroup = true;
                    }
                });
                if (!addedToGroup) {
                    ungroupedLearners.push(l);
                }
            }
        });
        
        const container = document.createElement('div');
        container.className = 'flex-col gap-md';

        const renderGroup = (groupId, groupName, groupLearners, hideIfEmpty = false) => {
            if (hideIfEmpty && groupLearners.length === 0) return;
            
            // Clone the array before sorting so we don't mutate the original
            const sortedLearners = [...groupLearners].sort((a, b) => a.name.localeCompare(b.name));

            const section = document.createElement('div');
            section.className = 'flex-col gap-xs';
            
            // Group Header (Select All for group)
            const headerDiv = document.createElement('div');
            headerDiv.style.display = 'flex';
            headerDiv.style.alignItems = 'center';
            headerDiv.style.gap = '8px';
            headerDiv.style.paddingBottom = '4px';
            headerDiv.style.borderBottom = '1px solid var(--border)';
            headerDiv.style.marginBottom = '4px';

            const headerCb = document.createElement('input');
            headerCb.type = 'checkbox';
            headerCb.className = 'group-cb';
            headerCb.dataset.group = groupId;
            headerCb.id = `group_cb_${groupId}_${Math.random().toString(36).substring(2, 9)}`;

            const headerLabel = document.createElement('label');
            headerLabel.htmlFor = headerCb.id;
            headerLabel.textContent = groupName;
            headerLabel.className = 'form-label-sm';
            headerLabel.style.margin = '0';
            headerLabel.style.cursor = 'pointer';

            headerCb.addEventListener('change', (e) => {
                this.toggleGroup(groupId, e.target.checked);
            });

            headerDiv.appendChild(headerCb);
            headerDiv.appendChild(headerLabel);
            section.appendChild(headerDiv);

            // Learners in this group
            if (sortedLearners.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.textContent = 'No learners in this group.';
                emptyMsg.style.fontSize = '0.85rem';
                emptyMsg.style.color = 'var(--text-muted)';
                emptyMsg.style.paddingLeft = '12px';
                emptyMsg.style.fontStyle = 'italic';
                section.appendChild(emptyMsg);
            } else {
                sortedLearners.forEach(l => {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.alignItems = 'center';
                    row.style.gap = '8px';
                    row.style.paddingLeft = '12px';

                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'learner-cb';
                    cb.dataset.group = groupId;
                    cb.value = l.learnerDataId;
                    const uniqueId = `learner_cb_${groupId}_${l.learnerDataId}_${Math.random().toString(36).substring(2, 9)}`;
                    cb.id = uniqueId;
                    cb.checked = this.selectedLearnerIds.has(l.learnerDataId);

                    cb.addEventListener('change', (e) => {
                        this.toggleLearner(l.learnerDataId, e.target.checked);
                    });

                    const label = document.createElement('label');
                    label.htmlFor = uniqueId;
                    label.textContent = l.displayName || l.name;
                    label.style.cursor = 'pointer';
                    label.style.fontSize = '0.9rem';

                    row.appendChild(cb);
                    row.appendChild(label);
                    section.appendChild(row);
                });
            }

            container.appendChild(section);
        };

        // Render All Learners
        renderGroup('all', 'All Learners', this.learners, false);

        // Render each defined group
        this.groups.sort((a, b) => a.name.localeCompare(b.name)).forEach(g => {
            renderGroup(g.id, g.name, learnersByGroup[g.id].learners, false);
        });

        // Render ungrouped
        renderGroup('ungrouped', 'Ungrouped', ungroupedLearners, true);

        this.appendChild(container);
        this.syncGroupSelectAll();
    }
}

customElements.define('learner-selector', LearnerSelector);
