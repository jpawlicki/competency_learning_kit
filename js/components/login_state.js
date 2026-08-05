export class LoginState extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Base structure
        this.shadowRoot.innerHTML = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0');
                
                :host {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    font-family: 'Inter', sans-serif;
                }
                .hidden {
                    display: none !important;
                }
                .btn-login {
                    background-color: #3b82f6;
                    color: white;
                    border: none;
                    padding: 0.5rem 1.25rem;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: 0.15s ease-in-out;
                    font-family: inherit;
                    font-size: 0.95rem;
                }
                .btn-login:hover {
                    background-color: #2563eb;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
                }
                .btn-logout {
                    background: #ffffff;
                    color: #0f172a;
                    border: 1px solid #e2e8f0;
                    padding: 0.5rem 1.25rem;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: 0.15s ease-in-out;
                    font-family: inherit;
                    font-size: 0.95rem;
                }
                .btn-logout:hover {
                    background-color: #f8fafc;
                }
                .user-avatar {
                    text-align: center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 32px;
                    height: 32px;
                    border-radius: 16px;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                }
                @keyframes pulse-auth-error {
                    0% {
                        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
                        border-color: rgba(239, 68, 68, 1);
                        color: rgba(239, 68, 68, 1);
                    }
                    70% {
                        box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
                        border-color: rgba(239, 68, 68, 1);
                        color: rgba(239, 68, 68, 1);
                    }
                    100% {
                        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
                        border-color: rgba(239, 68, 68, 1);
                        color: rgba(239, 68, 68, 1);
                    }
                }
                .pulse-alert {
                    animation: pulse-auth-error 2s infinite;
                    background-color: #fef2f2 !important;
                }
                .material-symbols-outlined {
                    font-family: 'Material Symbols Outlined';
                    font-weight: normal;
                    font-style: normal;
                    font-size: 24px;
                    line-height: 1;
                    letter-spacing: normal;
                    text-transform: none;
                    display: inline-block;
                    white-space: nowrap;
                    word-wrap: normal;
                    direction: ltr;
                    -webkit-font-feature-settings: 'liga';
                    -webkit-font-smoothing: antialiased;
                }
            </style>
            
            <button class="btn-login" id="btn-login">Sign In</button>
            <div class="user-avatar hidden" id="user-avatar" title="Logged in">
                <span class="material-symbols-outlined">person</span>
            </div>
            <button class="btn-logout hidden" id="btn-logout">Sign Out</button>
        `;

        this.btnLogin = this.shadowRoot.getElementById('btn-login');
        this.btnLogout = this.shadowRoot.getElementById('btn-logout');
        this.userAvatar = this.shadowRoot.getElementById('user-avatar');

        this.btnLogin.addEventListener('click', () => this.dispatchEvent(new CustomEvent('login-requested')));
        this.btnLogout.addEventListener('click', () => {
            if (this.btnLogout.classList.contains('pulse-alert')) {
                this.dispatchEvent(new CustomEvent('login-requested'));
            } else {
                this.dispatchEvent(new CustomEvent('logout-requested'));
            }
        });
    }

    setLoggedOut() {
        this.btnLogin.classList.remove('hidden');
        
        this.userAvatar.classList.add('hidden');
        this.userAvatar.innerHTML = '<span class="material-symbols-outlined">person</span>';
        this.userAvatar.setAttribute('title', 'Logged in');
        this.userAvatar.style.width = '32px';
        this.userAvatar.style.padding = '0';
        
        this.btnLogout.classList.add('hidden');
        this.btnLogout.classList.remove('pulse-alert');
        this.btnLogout.textContent = 'Sign Out';
    }

    setLoggedIn(email) {
        this.btnLogin.classList.add('hidden');
        this.userAvatar.classList.remove('hidden');
        this.btnLogout.classList.remove('hidden');
        this.btnLogout.classList.remove('pulse-alert');
        this.btnLogout.textContent = 'Sign Out';

        if (email) {
            this.userAvatar.setAttribute('title', `Logged in as ${email}`);
            this.userAvatar.innerHTML = `<span style="font-size: 0.8rem; font-weight: 500; padding: 0 0.5rem;">${email.split('@')[0]}</span>`;
            this.userAvatar.style.width = 'auto';
            this.userAvatar.style.padding = '0 0.25rem';
        } else {
            this.userAvatar.setAttribute('title', 'Logged in');
            this.userAvatar.innerHTML = '<span class="material-symbols-outlined">person</span>';
            this.userAvatar.style.width = '32px';
            this.userAvatar.style.padding = '0';
        }
    }

    setAuthError() {
        this.btnLogin.classList.add('hidden');
        this.btnLogout.classList.remove('hidden');
        this.btnLogout.classList.add('pulse-alert');
        this.btnLogout.textContent = 'Refresh Sign-In';
    }
}

customElements.define('clk-login-state', LoginState);
