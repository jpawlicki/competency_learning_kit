import { setElementContents } from '../utils.js';
export class CompetencyGroupSelector extends HTMLElement {
    constructor() {
        super();
        this.groups = [];
        this.selectedValue = 'all';
    }
    
    connectedCallback() {
        if (!this.rendered) {
            this.render();
            this.rendered = true;
        }
    }
    
    setGroups(groups) {
        this.groups = groups || [];
        this.render();
    }
    
    getValue() {
        return this.selectedValue;
    }
    
    setValue(val) {
        this.selectedValue = val;
        const select = this.querySelector('select');
        if (select) select.value = val;
    }

    render() {
        setElementContents(this);
        const select = document.createElement('select');
        select.className = 'select-filter';
        select.style.width = '100%';
        
        const allOpt = document.createElement('option');
        allOpt.value = 'all';
        allOpt.textContent = 'All Groups';
        select.appendChild(allOpt);
        
        this.groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            select.appendChild(opt);
        });
        
        select.value = this.selectedValue;
        
        select.addEventListener('change', (e) => {
            this.selectedValue = e.target.value;
            this.dispatchEvent(new CustomEvent('change', { detail: { selectedValue: this.selectedValue } }));
        });
        
        this.appendChild(select);
    }
}

customElements.define('competency-group-selector', CompetencyGroupSelector);
