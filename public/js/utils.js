/**
 * Helper to construct DOM elements safely and ergonomically.
 * @param {string} tag The HTML tag name.
 * @param {Object} attributes Object mapping of attribute names to values. 'className' maps to 'class', 'style' can be a string or an object.
 * @param {Array<HTMLElement|string>} children Array of child elements or strings (which become text nodes).
 * @returns {HTMLElement} The constructed element.
 */
export function createElement(tag, attributes = {}, children = []) {
    const el = document.createElement(tag);
    
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'className') {
            el.className = value;
        } else if (key === 'style') {
            if (typeof value === 'object') {
                for (const [styleKey, styleValue] of Object.entries(value)) {
                    el.style[styleKey] = styleValue;
                }
            } else {
                el.style.cssText = value;
            }
        } else if (key === 'textContent') {
            el.textContent = value;
        } else if (key === 'innerHTML') {
            // Only use if strictly necessary and input is safe!
            el.innerHTML = value;
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
            el.setAttribute(key, value);
        }
    }
    
    children.forEach(child => {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            el.appendChild(child);
        }
    });
    
    return el;
}

/**
 * Replaces the contents of an element with the provided children.
 * @param {HTMLElement} element The element to clear and populate.
 * @param {Array<HTMLElement|string>|HTMLElement|string} children Child element(s) or string(s).
 */
export function setElementContents(element, ...children) {
    element.innerHTML = '';
    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            element.appendChild(child);
        }
    });
}
