import { describe, it, assertEquals, assertTrue } from './test_runner.js';
import { UIPrefs } from '../js/data.js';

describe('UIPrefs (js/data.js)', () => {
    it('stores and retrieves access token', () => {
        const prefs = new UIPrefs();
        prefs.setAccessToken('test-token-123');
        assertEquals('test-token-123', prefs.getAccessToken());
        assertEquals('test-token-123', sessionStorage.getItem('clk_access_token'));
        
        prefs.clearAccessToken();
        assertEquals(null, prefs.getAccessToken());
        assertEquals(null, sessionStorage.getItem('clk_access_token'));
    });

    it('stores and retrieves user email', () => {
        const prefs = new UIPrefs();
        prefs.setUserEmail('test@example.com');
        assertEquals('test@example.com', prefs.getUserEmail());
        assertEquals('test@example.com', localStorage.getItem('clk_user_email'));
        
        prefs.clearUserEmail();
        assertEquals(null, prefs.getUserEmail());
        assertEquals(null, localStorage.getItem('clk_user_email'));
    });

    it('handles project component IDs', () => {
        const prefs = new UIPrefs();
        prefs.setProjectComponentIds({ folderId: 'f1', rootDataId: 'r1', learnersFolderId: 'l1' });
        
        const ids = prefs.getProjectComponentIds();
        assertEquals('f1', ids.folderId);
        assertEquals('r1', ids.rootDataId);
        assertEquals('l1', ids.learnersFolderId);
        
        prefs.clearProjectComponentIds();
        assertEquals(null, prefs.getProjectComponentIds());
    });
});
