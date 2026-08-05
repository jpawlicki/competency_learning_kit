export class SetupWizard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: 1000;
                    font-family: 'Inter', sans-serif;
                    align-items: center;
                    justify-content: center;
                }
                :host(.active) {
                    display: flex;
                }
                .modal {
                    background: #ffffff;
                    border-radius: 12px;
                    padding: 2rem;
                    max-width: 500px;
                    width: 90%;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                h2 {
                    margin: 0;
                    color: #0f172a;
                }
                p {
                    margin: 0;
                    color: #64748b;
                    font-size: 0.95rem;
                    line-height: 1.5;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                label {
                    font-weight: 500;
                    font-size: 0.9rem;
                    color: #0f172a;
                }
                input[type="text"] {
                    padding: 0.75rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-family: inherit;
                    font-size: 0.95rem;
                }
                input[type="text"]:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                .radio-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    max-height: 200px;
                    overflow-y: auto;
                    border: 1px solid #e2e8f0;
                    padding: 1rem;
                    border-radius: 8px;
                }
                .radio-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    font-size: 0.95rem;
                    font-weight: normal;
                }
                .warning {
                    display: none;
                    background: #fffbeb;
                    color: #92400e;
                    border: 1px solid #fde68a;
                    padding: 1rem;
                    border-radius: 8px;
                    font-size: 0.9rem;
                }
                .warning.active {
                    display: block;
                }
                .btn-primary {
                    background-color: #3b82f6;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: 0.15s ease-in-out;
                    font-family: inherit;
                    font-size: 1rem;
                    margin-top: 1rem;
                }
                .btn-primary:hover:not(:disabled) {
                    background-color: #2563eb;
                }
                .btn-primary:disabled {
                    background-color: #94a3b8;
                    cursor: not-allowed;
                }
                .loader {
                    display: none;
                    color: #3b82f6;
                    font-weight: 500;
                    text-align: center;
                }
                .loader.active {
                    display: block;
                }
            </style>
            
            <div class="modal">
                <h2>Welcome to CLK!</h2>
                <p>Competency Learning Kit stores your data securely in Google Drive. Let's set up your project folder.</p>
                
                <div class="loader" id="loading-drives">Loading available drives...</div>

                <div class="form-group" id="drive-selection" style="display: none;">
                    <label>Select Drive Location:</label>
                    <div class="radio-group" id="drive-list">
                        <!-- Populated dynamically -->
                    </div>
                </div>

                <div class="warning" id="personal-warning">
                    <strong>Notice:</strong> You selected your Personal Drive. Only you will have access to this data by default. It will not be shared with your organization automatically.
                </div>

                <div class="form-group">
                    <label for="inst-name">Institution Name (Optional)</label>
                    <input type="text" id="inst-name" placeholder="e.g., Springfield Elementary">
                </div>

                <button class="btn-primary" id="btn-submit" disabled>Create Data Folder</button>
            </div>
        `;

        this.btnSubmit = this.shadowRoot.getElementById('btn-submit');
        this.instNameInput = this.shadowRoot.getElementById('inst-name');
        this.driveList = this.shadowRoot.getElementById('drive-list');
        this.loadingDrives = this.shadowRoot.getElementById('loading-drives');
        this.driveSelection = this.shadowRoot.getElementById('drive-selection');
        this.personalWarning = this.shadowRoot.getElementById('personal-warning');

        this.storage = null;
        this.selectedDriveId = null;

        this.shadowRoot.addEventListener('change', (e) => {
            if (e.target.name === 'drive') {
                this.selectedDriveId = e.target.value === 'personal' ? null : e.target.value;
                if (e.target.value === 'personal') {
                    this.personalWarning.classList.add('active');
                } else {
                    this.personalWarning.classList.remove('active');
                }
                this.btnSubmit.disabled = false;
            }
        });

        this.btnSubmit.addEventListener('click', async () => {
            if (this.btnSubmit.disabled) return;
            
            this.btnSubmit.disabled = true;
            this.btnSubmit.textContent = 'Creating...';
            const instName = this.instNameInput.value.trim();

            try {
                await this.storage.initializeData(instName, this.selectedDriveId);
                this.classList.remove('active');
                this.dispatchEvent(new CustomEvent('setup-complete'));
            } catch (err) {
                console.error(err);
                alert('Error initializing data: ' + err.message);
                this.btnSubmit.disabled = false;
                this.btnSubmit.textContent = 'Create Data Folder';
            }
        });
    }

    async start(storage) {
        this.storage = storage;
        this.classList.add('active');
        this.loadingDrives.classList.add('active');
        this.driveSelection.style.display = 'none';
        this.btnSubmit.disabled = true;
        this.btnSubmit.textContent = 'Create Data Folder';
        this.driveList.innerHTML = '';
        this.personalWarning.classList.remove('active');
        this.selectedDriveId = null;

        try {
            const drives = await this.storage.getAvailableDrives();
            
            drives.forEach(drive => {
                const label = document.createElement('label');
                label.className = 'radio-label';
                label.innerHTML = `<input type="radio" name="drive" value="${drive.id}"> ${drive.name}`;
                this.driveList.appendChild(label);
            });

            // Add personal drive as final option
            const personalLabel = document.createElement('label');
            personalLabel.className = 'radio-label';
            personalLabel.innerHTML = `<input type="radio" name="drive" value="personal"> My Drive (Personal)`;
            this.driveList.appendChild(personalLabel);

        } catch (err) {
            console.error('Failed to load drives:', err);
            // Fallback to just personal
            const personalLabel = document.createElement('label');
            personalLabel.className = 'radio-label';
            personalLabel.innerHTML = `<input type="radio" name="drive" value="personal"> My Drive (Personal)`;
            this.driveList.appendChild(personalLabel);
        } finally {
            this.loadingDrives.classList.remove('active');
            this.driveSelection.style.display = 'flex';
        }
    }
}

customElements.define('clk-setup-wizard', SetupWizard);
