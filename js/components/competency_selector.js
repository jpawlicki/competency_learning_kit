import { createElement, setElementContents } from '../utils.js';
export class CompetencySelector extends HTMLElement {
    constructor() {
        super();
        this.competencies = [];
        this.groups = [];
        this.suggestedIds = [];
        this.selectedCompetencyIds = new Set();
    }
    
    connectedCallback() {
        if (!this.rendered) {
            this.render();
            this.rendered = true;
        }
    }
    
    setCompetencies(competencies, groups, suggestedIds = []) {
        this.competencies = competencies || [];
        this.groups = groups || [];
        this.suggestedIds = suggestedIds || [];
        
        // Preserve selected IDs that are still valid
        const validIds = new Set(this.competencies.map(c => c.id));
        const newSelected = new Set();
        for (const id of this.selectedCompetencyIds) {
            if (validIds.has(id)) newSelected.add(id);
        }
        this.selectedCompetencyIds = newSelected;
        
        this.render();
    }

    getSelectedCompetencies() {
        return Array.from(this.selectedCompetencyIds);
    }
    
    clearSelection() {
        this.selectedCompetencyIds.clear();
        this.render();
        this.dispatchEvent(new CustomEvent('change', { detail: { selectedIds: this.getSelectedCompetencies() } }));
    }

    toggleCompetency(id, isSelected) {
        if (isSelected) {
            this.selectedCompetencyIds.add(id);
        } else {
            this.selectedCompetencyIds.delete(id);
        }
        
        // Sync checkboxes in DOM across all instances
        const checkboxes = this.querySelectorAll(`input.comp-cb[value="${id}"]`);
        checkboxes.forEach(cb => cb.checked = isSelected);

        this.syncGroupSelectAll();
        
        this.dispatchEvent(new CustomEvent('change', { detail: { selectedIds: this.getSelectedCompetencies() } }));
    }
    
    toggleGroup(groupId, isSelected) {
        const cbs = this.querySelectorAll(`input.comp-cb[data-group="${groupId}"]`);
        
        cbs.forEach(cb => {
            const id = cb.value;
            if (isSelected) {
                this.selectedCompetencyIds.add(id);
            } else {
                this.selectedCompetencyIds.delete(id);
            }
        });
        
        const allCompCbs = this.querySelectorAll('input.comp-cb');
        allCompCbs.forEach(cb => {
            cb.checked = this.selectedCompetencyIds.has(cb.value);
        });
        
        this.syncGroupSelectAll();
        this.dispatchEvent(new CustomEvent('change', { detail: { selectedIds: this.getSelectedCompetencies() } }));
    }

    syncGroupSelectAll() {
        const groupCbs = this.querySelectorAll('.group-cb');
        groupCbs.forEach(gCb => {
            const groupId = gCb.dataset.group;
            const cbs = Array.from(this.querySelectorAll(`input.comp-cb[data-group="${groupId}"]`));
            if (cbs.length > 0) {
                gCb.checked = cbs.every(cb => cb.checked);
            } else {
                gCb.checked = false;
            }
        });
    }

    render() {
        setElementContents(this);
        
        if (this.competencies.length === 0) {
            setElementContents(this, createElement('div', { className: 'placeholder-text', style: 'font-size: 0.9rem;', textContent: 'No competencies found.' }));
            return;
        }

        const container = document.createElement('div');
        container.className = 'flex-col gap-md';

        const renderGroup = (groupId, groupName, groupComps, isSuggested = false) => {
            if (groupComps.length === 0) return;
            
            const sortedComps = [...groupComps].sort((a, b) => a.name.localeCompare(b.name));

            const section = document.createElement('div');
            section.className = 'flex-col gap-xs';
            
            if (isSuggested) {
                section.style.border = '1px solid var(--brand)';
                section.style.borderRadius = '6px';
                section.style.padding = '8px';
                section.style.background = 'var(--primary-bg)';
            }
            
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
            headerCb.id = `comp_group_cb_${groupId}_${Math.random().toString(36).substring(2, 9)}`;

            const headerLabel = document.createElement('label');
            headerLabel.htmlFor = headerCb.id;
            headerLabel.textContent = groupName;
            headerLabel.className = 'form-label-sm';
            headerLabel.style.margin = '0';
            headerLabel.style.cursor = 'pointer';
            
            if (isSuggested) {
                headerLabel.style.color = 'var(--brand)';
                headerLabel.style.textTransform = 'uppercase';
            }

            headerCb.addEventListener('change', (e) => {
                this.toggleGroup(groupId, e.target.checked);
            });

            headerDiv.appendChild(headerCb);
            headerDiv.appendChild(headerLabel);
            section.appendChild(headerDiv);

            const listContainer = document.createElement('div');
            listContainer.style.display = 'grid';
            listContainer.style.gridTemplateColumns = '1fr 1fr';
            listContainer.style.gap = '8px';

            sortedComps.forEach(c => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.gap = '8px';

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'comp-cb';
                cb.dataset.group = groupId;
                cb.value = c.id;
                const uniqueId = `comp_cb_${groupId}_${c.id}_${Math.random().toString(36).substring(2, 9)}`;
                cb.id = uniqueId;
                cb.checked = this.selectedCompetencyIds.has(c.id);

                cb.addEventListener('change', (e) => {
                    this.toggleCompetency(c.id, e.target.checked);
                });

                const label = document.createElement('label');
                label.htmlFor = uniqueId;
                label.textContent = c.name;
                label.title = c.description || '';
                label.style.cursor = 'pointer';
                label.style.fontSize = '0.85rem';

                row.appendChild(cb);
                row.appendChild(label);
                listContainer.appendChild(row);
            });

            section.appendChild(listContainer);
            container.appendChild(section);
        };

        // Render Suggested
        if (this.suggestedIds.length > 0) {
            const suggestedComps = this.competencies.filter(c => this.suggestedIds.includes(c.id));
            renderGroup('suggested', 'Suggested for this Assignment', suggestedComps, true);
        }

        // Render each defined group
        const compsByGroup = {};
        const ungroupedComps = [];

        this.groups.forEach(g => {
            compsByGroup[g.id] = { name: g.name, competencies: [] };
        });

        this.competencies.forEach(c => {
            // Find which group contains this competency
            const group = this.groups.find(g => g.competencyIds && g.competencyIds.includes(c.id));
            if (group) {
                compsByGroup[group.id].competencies.push(c);
            } else {
                ungroupedComps.push(c);
            }
        });

        this.groups.sort((a, b) => a.name.localeCompare(b.name)).forEach(g => {
            renderGroup(g.id, g.name, compsByGroup[g.id].competencies, false);
        });

        // Render ungrouped
        renderGroup('ungrouped', 'Ungrouped', ungroupedComps, false);

        this.appendChild(container);
        this.syncGroupSelectAll();
    }
}

customElements.define('competency-selector', CompetencySelector);
