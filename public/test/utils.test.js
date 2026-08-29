import { describe, it, assertEquals, assertTrue } from './test_runner.js';
import { createElement, setElementContents } from '../js/utils.js';

describe('utils.js', () => {
    it('createElement creates a basic element', () => {
        const el = createElement('div', { id: 'test-id', className: 'test-class' });
        assertEquals('DIV', el.tagName);
        assertEquals('test-id', el.id);
        assertEquals('test-class', el.className);
    });

    it('createElement adds text content and children', () => {
        const child1 = createElement('span');
        const child2 = createElement('b');
        const el = createElement('div', {}, ['Text', child1, child2]);
        
        assertEquals(3, el.childNodes.length);
        assertEquals(Node.TEXT_NODE, el.childNodes[0].nodeType);
        assertEquals('Text', el.childNodes[0].textContent);
        assertEquals('SPAN', el.childNodes[1].tagName);
        assertEquals('B', el.childNodes[2].tagName);
    });

    it('createElement handles style attributes correctly', () => {
        const el = createElement('div', { style: { color: 'red', marginTop: '10px' } });
        assertEquals('red', el.style.color);
        assertEquals('10px', el.style.marginTop);
        
        const el2 = createElement('div', { style: 'color: blue; padding: 5px;' });
        assertEquals('blue', el2.style.color);
        assertEquals('5px', el2.style.padding);
    });

    it('createElement attaches event listeners', () => {
        let clicked = false;
        const el = createElement('button', { onclick: () => { clicked = true; } });
        el.click();
        assertTrue(clicked, 'Click event listener should have been called');
    });

    it('setElementContents replaces children', () => {
        const parent = createElement('div', {}, [createElement('span')]);
        assertEquals(1, parent.childNodes.length);
        
        const newChild = createElement('strong');
        setElementContents(parent, 'New text', newChild);
        
        assertEquals(2, parent.childNodes.length);
        assertEquals('New text', parent.childNodes[0].textContent);
        assertEquals('STRONG', parent.childNodes[1].tagName);
    });
});
