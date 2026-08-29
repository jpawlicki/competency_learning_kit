/**
 * A lightweight, zero-dependency testing utility for the browser.
 */

const suites = [];
let currentSuite = null;

export function describe(name, fn) {
    const suite = { name, tests: [] };
    suites.push(suite);
    currentSuite = suite;
    fn();
    currentSuite = null;
}

export function it(name, fn) {
    if (!currentSuite) {
        throw new Error('it() must be called inside a describe() block');
    }
    currentSuite.tests.push({ name, fn });
}

export function assertEquals(expected, actual, message = '') {
    if (expected !== actual) {
        throw new Error(`Assertion Failed: ${message}\nExpected: ${expected}\nActual: ${actual}`);
    }
}

export function assertTrue(condition, message = 'Expected true') {
    if (condition !== true) {
        throw new Error(`Assertion Failed: ${message}`);
    }
}

export function assertFalse(condition, message = 'Expected false') {
    if (condition !== false) {
        throw new Error(`Assertion Failed: ${message}`);
    }
}

export function assertThrows(fn, message = 'Expected function to throw') {
    let threw = false;
    try {
        fn();
    } catch (e) {
        threw = true;
    }
    if (!threw) {
        throw new Error(`Assertion Failed: ${message}`);
    }
}

export async function runTests() {
    const container = document.getElementById('test-results');
    if (!container) {
        console.error('Test results container #test-results not found');
        return;
    }
    
    let totalPass = 0;
    let totalFail = 0;
    
    container.innerHTML = '<h2>Running Tests...</h2>';
    
    const resultsHtml = [];
    
    for (const suite of suites) {
        let suiteHtml = `<div class="suite"><h3>${suite.name}</h3><ul>`;
        for (const test of suite.tests) {
            try {
                // If the test returns a promise, await it.
                const result = test.fn();
                if (result instanceof Promise) {
                    await result;
                }
                suiteHtml += `<li class="pass">✅ ${test.name}</li>`;
                totalPass++;
            } catch (error) {
                suiteHtml += `<li class="fail">❌ ${test.name}<br><pre>${error.message}</pre></li>`;
                totalFail++;
            }
        }
        suiteHtml += `</ul></div>`;
        resultsHtml.push(suiteHtml);
    }
    
    const summaryColor = totalFail === 0 ? 'green' : 'red';
    const summaryHtml = `<h2 style="color: ${summaryColor}">Results: ${totalPass} Passed, ${totalFail} Failed</h2>`;
    
    container.innerHTML = summaryHtml + resultsHtml.join('');
}
