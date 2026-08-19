/**
 * data.js contains interfaces for reading and writing data to persistent storage.
 *
 * The default backend storage solution is Google Drive, with cached data in browser-local and session storage.
 */


// PUBLIC INTERFACES

/**
 * Create a new storage instance hooked up to Google Drive.
 * @param {UIPrefs} [uiPrefs] - UIPrefs instance for component ID & token access composition.
 * @returns {Storage}
 */
export function createStorageGoogleDrive(uiPrefs = createUIPrefsBrowserStorage()) {
  return new Storage(uiPrefs);
}

/**
 * Create a new UIPrefs instance stored in browser storage.
 * @returns {UIPrefs}
 */
export function createUIPrefsBrowserStorage() {
  return new UIPrefs();
}

export class Storage {
  constructor(uiPrefs = createUIPrefsBrowserStorage()) {
    this.uiPrefs = uiPrefs;
    this.folderId = '';
    this.rootDataId = '';
    this.learnersFolderId = '';
    this.FOLDER_NAME = 'Competency Learning Kit Data';
    this.ROOT_DATA_NAME = 'Root Data';
    this.LEARNERS_FOLDER_NAME = 'Learners';
  }

  getAccessToken() {
    return this.uiPrefs.getAccessToken();
  }

  async driveRequest(path, options = {}) {
    const token = this.getAccessToken();
    if (!token) throw new Error("Google Drive access token not set.");
    const url = `https://www.googleapis.com/drive/v3${path}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      if (response.status === 401) window.dispatchEvent(new CustomEvent('clk-auth-error'));
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Drive API request failed (${response.status})`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async sheetsRequest(spreadsheetId, path, options = {}) {
    const token = this.getAccessToken();
    if (!token) throw new Error("Google Drive access token not set.");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      if (response.status === 401) window.dispatchEvent(new CustomEvent('clk-auth-error'));
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Sheets API request failed (${response.status})`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async uploadFileToDrive(file, parents = []) {
    const token = this.getAccessToken();
    if (!token) throw new Error("Google Drive access token not set.");
    const metadata = {
      name: file.name,
      parents: parents
    };

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
    const contentType = file.type || 'application/octet-stream';
    const metadataPart = 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata);
    const mediaPartHeader = '\r\nContent-Type: ' + contentType + '\r\n\r\n';

    const blob = new Blob([
      delimiter,
      metadataPart,
      delimiter,
      mediaPartHeader,
      file,
      close_delim
    ], { type: 'multipart/related; boundary=' + boundary });

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: blob
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'File upload failed');
    }

    return response.json();
  }

  async getAvailableDrives() {
    const res = await this.driveRequest('/drives');
    return res.drives || [];
  }

  async resolveProjectComponents() {
    if (this.folderId && this.rootDataId && this.learnersFolderId) {
      return { folderId: this.folderId, rootDataId: this.rootDataId, learnersFolderId: this.learnersFolderId };
    }

    const cached = this.uiPrefs.getProjectComponentIds();
    let folderId = this.folderId || cached?.folderId || null;
    let rootDataId = this.rootDataId || cached?.rootDataId || null;
    let learnersFolderId = this.learnersFolderId || cached?.learnersFolderId || null;

    if (!folderId) {
      const query = encodeURIComponent(`name = '${this.FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
      const res = await this.driveRequest(`/files?q=${query}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`);
      if (res.files && res.files.length > 0) {
        folderId = res.files[0].id;
      } else {
        return null;
      }
    }

    if (folderId && (!rootDataId || !learnersFolderId)) {
      const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const data = await this.driveRequest(`/files?q=${query}&fields=files(id,name,mimeType)&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`);
      for (const file of (data.files || [])) {
        if (file.name === this.ROOT_DATA_NAME && file.mimeType === 'application/vnd.google-apps.spreadsheet') {
          rootDataId = file.id;
        } else if (file.name === this.LEARNERS_FOLDER_NAME && file.mimeType === 'application/vnd.google-apps.folder') {
          learnersFolderId = file.id;
        }
      }
    }

    this.folderId = folderId;
    this.rootDataId = rootDataId;
    this.learnersFolderId = learnersFolderId;

    if (folderId) {
      this.uiPrefs.setProjectComponentIds({ folderId, rootDataId, learnersFolderId });
    }

    return { folderId, rootDataId, learnersFolderId };
  }

  async initializeData(institutionName, driveId = null) {
    const cached = this.uiPrefs.getProjectComponentIds();
    let parentId = this.folderId || cached?.folderId || null;

    if (!parentId) {
      const requestBody = {
        name: this.FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      };
      if (driveId) {
        requestBody.parents = [driveId];
      }
      const folder = await this.driveRequest('/files?fields=id&supportsAllDrives=true', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      parentId = folder.id;
    }

    let rootDataId = this.rootDataId || cached?.rootDataId || null;
    if (!rootDataId) {
      const rd = await this.driveRequest('/files?fields=id&supportsAllDrives=true', {
        method: 'POST',
        body: JSON.stringify({
          name: this.ROOT_DATA_NAME,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          parents: [parentId]
        })
      });
      rootDataId = rd.id;

      const initialRows = [
        ['Comment', "This file is used by the Competency Learning Kit system. Please don't manually make any changes."],
        ['Institution Name', institutionName || '']
      ];

      await this.sheetsRequest(rootDataId, '/values/A1:append?valueInputOption=USER_ENTERED', {
        method: 'POST',
        body: JSON.stringify({ values: initialRows })
      });
    }

    let learnersId = this.learnersFolderId || cached?.learnersFolderId || null;
    if (!learnersId) {
      const l = await this.driveRequest('/files?fields=id&supportsAllDrives=true', {
        method: 'POST',
        body: JSON.stringify({
          name: this.LEARNERS_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId]
        })
      });
      learnersId = l.id;
    }

    this.folderId = parentId;
    this.rootDataId = rootDataId;
    this.learnersFolderId = learnersId;

    this.uiPrefs.setProjectComponentIds({
      folderId: parentId,
      rootDataId: rootDataId,
      learnersFolderId: learnersId
    });

    return { folderId: parentId, rootDataId, learnersFolderId: learnersId };
  }

  async scanProjectForDeletion() {
    const components = await this.resolveProjectComponents();
    if (!components || !components.folderId) return [];

    const list = [];
    const rootFolder = await this.driveRequest(`/files/${components.folderId}?fields=id,name,mimeType&supportsAllDrives=true`);
    if (rootFolder) list.push(rootFolder);

    const recursiveList = async (parentId) => {
      const query = encodeURIComponent(`'${parentId}' in parents and trashed = false`);
      const data = await this.driveRequest(`/files?q=${query}&fields=files(id,name,mimeType)&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`);
      for (const file of (data.files || [])) {
        list.push(file);
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          await recursiveList(file.id);
        }
      }
    };

    await recursiveList(components.folderId);
    return list;
  }

  async deleteProject() {
    const components = await this.resolveProjectComponents();
    if (!components || !components.folderId) return;

    await this.driveRequest(`/files/${components.folderId}?supportsAllDrives=true`, { method: 'DELETE' });

    this.uiPrefs.clearProjectComponentIds();

    this.folderId = null;
    this.rootDataId = null;
    this.learnersFolderId = null;
  }

  async readRootData() {
    const components = await this.resolveProjectComponents();
    if (!components || !components.rootDataId) return null;

    const data = await this.sheetsRequest(components.rootDataId, '/values/A:Z');
    const rows = data.values || [];

    const rootDict = {
      'Comment': [],
      'Institution Name': null,
      'Global Write Permission': [],
      'Global Read Permission': [],
      'Student': [],
      'Google Classroom': [],
      'Competency': [],
      'Competency Group': [],
      'Learner Group': [],
      'Radial Report Template': []
    };

    rows.forEach(row => {
      const type = row[0];
      if (!type) return;

      if (type === 'Comment') {
        rootDict['Comment'].push(row[1] || '');
      } else if (type === 'Institution Name') {
        rootDict['Institution Name'] = row[1] || '';
      } else if (type === 'Global Write Permission') {
        rootDict['Global Write Permission'].push(row[1] || '');
      } else if (type === 'Global Read Permission') {
        rootDict['Global Read Permission'].push(row[1] || '');
      } else if (type === 'Student') {
        rootDict['Student'].push({
          name: row[1] || '',
          folderId: row[2] || '',
          learnerDataId: row[3] || '',
          artifactsId: row[4] || '',
          nickname: row[5] || row[1] || '',
          classroomId: row[6] || '',
          groupIds: row[7] ? row[7].split(';').filter(Boolean) : []
        });
      } else if (type === 'Google Classroom' || type === 'Classroom') {
        rootDict['Google Classroom'].push({
          id: row[1] || '',
          name: row[2] || 'Unknown'
        });
      } else if (type === 'Competency' || type === 'Goal') {
        rootDict['Competency'].push({
          id: row[1] || '',
          name: row[2] || '',
          relatedIds: row[3] ? row[3].split(';').filter(Boolean) : [],
          state: row[4] || 'ACTIVE',
          rank: parseFloat(row[5]) || 0,
          description: row[6] || '',
          rubric: row[7] || '',
          color: row[8] || '#94a3b8'
        });
      } else if (type === 'Competency Group') {
        rootDict['Competency Group'].push({
          id: row[1] || '',
          name: row[2] || '',
          competencyIds: row[3] ? row[3].split(';').filter(Boolean) : [],
          description: row[4] || ''
        });
      } else if (type === 'Learner Group') {
        rootDict['Learner Group'].push({
          id: row[1] || '',
          name: row[2] || '',
          description: row[3] || ''
        });
      } else if (type === 'Radial Report Template') {
        rootDict['Radial Report Template'].push({
          id: row[1] || '',
          name: row[2] || '',
          config: row[3] || '',
          innerRadius: parseFloat(row[4]) || 50,
          outerRadius: parseFloat(row[5]) || 250
        });
      }
    });

    return rootDict;
  }

  async readLearnerData(id) {
    const data = await this.sheetsRequest(id, '/values/A:Z');
    const rows = data.values || [];

    const learnerDict = {
      'Comment': [],
      'Student Name': null,
      'Read Permission': [],
      'Write Permission': [],
      'Evidence': [],
      'Observation': [],
      'Assessment': [],
      'Group': []
    };

    rows.forEach(row => {
      const type = row[0];
      if (!type) return;

      if (type === 'Comment') {
        learnerDict['Comment'].push(row[1] || '');
      } else if (type === 'Student Name') {
        learnerDict['Student Name'] = row[1] || '';
      } else if (type === 'Group') {
        learnerDict['Group'].push({ id: row[1] || '' });
      } else if (type === 'Read Permission') {
        learnerDict['Read Permission'].push(row[1] || '');
      } else if (type === 'Write Permission') {
        learnerDict['Write Permission'].push(row[1] || '');
      } else if (type === 'Evidence') {
        learnerDict['Evidence'].push({
          id: row[1] || '',
          name: row[2] || '',
          observations: row[3] || '',
          artifactIds: row[4] ? row[4].split(';').filter(Boolean) : [],
          note: row[5] || '',
          timestamp: row[6] || '',
          authorEmail: row[7] || ''
        });
      } else if (type === 'Observation') {
        learnerDict['Observation'].push({
          id: row[1] || '',
          competencyId: row[2] || '',
          authorEmail: row[3] || '',
          rating: parseFloat(row[4]) || 0,
          timestamp: row[5] || ''
        });
      } else if (type === 'Assessment') {
        learnerDict['Assessment'].push({
          id: row[1] || '',
          assessmentGroupId: row[2] || '',
          competencyId: row[3] || '',
          assessorEmail: row[4] || '',
          rating: (row[5] !== '' && row[5] !== undefined) ? parseFloat(row[5]) : undefined,
          summativeNote: row[6] || '',
          guidance: row[7] || '',
          timestamp: row[8] || ''
        });
      }
    });

    return learnerDict;
  }

  async addLearner(name, classroomId = '', groupIds = []) {
    const components = await this.resolveProjectComponents();
    if (!components || !components.learnersFolderId || !components.rootDataId) {
      throw new Error("CLK project structure not initialized.");
    }

    const studentFolder = await this.driveRequest('/files?fields=id&supportsAllDrives=true', {
      method: 'POST',
      body: JSON.stringify({
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [components.learnersFolderId]
      })
    });

    const learnerData = await this.driveRequest('/files?fields=id&supportsAllDrives=true', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Learner Data',
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: [studentFolder.id]
      })
    });

    const initialRows = [
      ['Comment', "This file is used by the Competency Learning Kit system. Please don't manually make any changes."],
      ['Student Name', name]
    ];
    for (const groupId of groupIds) {
      initialRows.push(['Group', groupId]);
    }

    await this.sheetsRequest(learnerData.id, '/values/A1:append?valueInputOption=USER_ENTERED', {
      method: 'POST',
      body: JSON.stringify({
        values: initialRows
      })
    });

    const artifactsFolder = await this.driveRequest('/files?fields=id&supportsAllDrives=true', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Artifacts',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [studentFolder.id]
      })
    });

    const studentRow = ['Student', name, studentFolder.id, learnerData.id, artifactsFolder.id, name, classroomId, groupIds.join(';')];
    await this.sheetsRequest(components.rootDataId, '/values/A1:append?valueInputOption=USER_ENTERED', {
      method: 'POST',
      body: JSON.stringify({ values: [studentRow] })
    });

    return {
      name: name,
      folderId: studentFolder.id,
      learnerDataId: learnerData.id,
      artifactsId: artifactsFolder.id,
      nickname: name,
      classroomId: classroomId,
      groupIds: groupIds
    };
  }

  async deleteLearner(name) {
    const components = await this.resolveProjectComponents();
    if (!components || !components.rootDataId) throw new Error("Root Data spreadsheet not found.");

    const data = await this.sheetsRequest(components.rootDataId, '/values/A:Z');
    const existingRows = data.values || [];

    const studentRowIndex = existingRows.findIndex(r => r[0] === 'Student' && r[1] === name);
    if (studentRowIndex === -1) {
        throw new Error("Student not found.");
    }
    const folderId = existingRows[studentRowIndex][2];

    if (folderId) {
        try {
            await this.driveRequest(`/files/${folderId}?supportsAllDrives=true`, { method: 'DELETE' });
        } catch(e) {
            console.warn("Could not delete folder from drive:", e);
        }
    }

    await this.sheetsRequest(components.rootDataId, ':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId: 0,
              dimension: 'ROWS',
              startIndex: studentRowIndex,
              endIndex: studentRowIndex + 1
            }
          }
        }]
      })
    });
  }

  async updateLearnerGroups(groups) {
    const components = await this.resolveProjectComponents();
    if (!components || !components.rootDataId) {
      throw new Error("CLK project structure not initialized.");
    }
    const data = await this.sheetsRequest(components.rootDataId, '/values/A:Z');
    const existingRows = data.values || [];

    // Keep everything that is NOT a Learner Group
    const filteredRows = existingRows.filter(row => row[0] !== 'Learner Group');

    const groupRows = groups.map(g => [
      'Learner Group',
      g.id,
      g.name,
      g.description || ''
    ]);

    const newRows = [...filteredRows, ...groupRows];

    await this.sheetsRequest(components.rootDataId, '/values/A:Z:clear', { method: 'POST' });
    await this.sheetsRequest(components.rootDataId, '/values/A1?valueInputOption=USER_ENTERED', {
      method: 'PUT',
      body: JSON.stringify({ values: newRows })
    });
  }

  async linkLearnerToClassroom(name, classroomId) {
    const components = await this.resolveProjectComponents();
    if (!components || !components.rootDataId) throw new Error("Root Data spreadsheet not found.");

    const data = await this.sheetsRequest(components.rootDataId, '/values/A:Z');
    const existingRows = data.values || [];

    const studentRowIndex = existingRows.findIndex(r => r[0] === 'Student' && r[1] === name);
    if (studentRowIndex === -1) {
        throw new Error("Student not found.");
    }

    // Ensure the row has enough columns (column 4 is index 4, which means length >= 5)
    while (existingRows[studentRowIndex].length < 5) {
        existingRows[studentRowIndex].push('');
    }
    existingRows[studentRowIndex][4] = classroomId;

    await this.sheetsRequest(components.rootDataId, '/values/A:Z:clear', { method: 'POST' });
    await this.sheetsRequest(components.rootDataId, '/values/A1?valueInputOption=USER_ENTERED', {
      method: 'PUT',
      body: JSON.stringify({ values: existingRows })
    });
  }

  async updateInstitutionName(newName) {
    const components = await this.resolveProjectComponents();
    if (!components || !components.folderId || !components.rootDataId) throw new Error("Project not found.");

    // 1. Update folder name
    await this.driveRequest(`/files/${components.folderId}?supportsAllDrives=true`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName + ' - CLK Data' })
    });

    // 2. Update spreadsheet row
    const data = await this.sheetsRequest(components.rootDataId, '/values/A:Z');
    const existingRows = data.values || [];

    let found = false;
    for (let i = 0; i < existingRows.length; i++) {
        if (existingRows[i][0] === 'Institution Name') {
            existingRows[i][1] = newName;
            found = true;
            break;
        }
    }

    if (!found) {
        existingRows.unshift(['Institution Name', newName]);
    }

    await this.sheetsRequest(components.rootDataId, '/values/A:Z:clear', { method: 'POST' });
    await this.sheetsRequest(components.rootDataId, '/values/A1?valueInputOption=USER_ENTERED', {
      method: 'PUT',
      body: JSON.stringify({ values: existingRows })
    });
  }

  async saveCompetencyArchitecture(competencies, groups) {
    const components = await this.resolveProjectComponents();
    if (!components || !components.rootDataId) throw new Error("Root Data spreadsheet not found.");

    const data = await this.sheetsRequest(components.rootDataId, '/values/A:Z');
    const existingRows = data.values || [];

    // Keep everything that is NOT a Competency, Goal, or Competency Group
    const filteredRows = existingRows.filter(row =>
        row[0] !== 'Competency' &&
        row[0] !== 'Goal' &&
        row[0] !== 'Competency Group'
    );

    const competencyRows = competencies.map(c => [
      'Competency',
      c.id,
      c.name,
      (c.relatedIds || []).join(';'),
      c.state || 'ACTIVE',
      c.rank !== undefined ? c.rank.toString() : '0',
      c.description || '',
      c.rubric || '',
      c.color || '#94a3b8'
    ]);

    const groupRows = groups.map(g => [
      'Competency Group',
      g.id,
      g.name,
      (g.competencyIds || []).join(';'),
      g.description || ''
    ]);

    const newRows = [...filteredRows, ...competencyRows, ...groupRows];

    await this.sheetsRequest(components.rootDataId, '/values/A:Z:clear', { method: 'POST' });
    await this.sheetsRequest(components.rootDataId, '/values/A1?valueInputOption=USER_ENTERED', {
      method: 'PUT',
      body: JSON.stringify({ values: newRows })
    });
  }

  async saveReportTemplates(templates) {
    const components = await this.resolveProjectComponents();
    if (!components || !components.rootDataId) throw new Error("Root Data spreadsheet not found.");

    const data = await this.sheetsRequest(components.rootDataId, '/values/A:Z');
    const existingRows = data.values || [];

    // Keep everything that is NOT a Radial Report Template
    const filteredRows = existingRows.filter(row => row[0] !== 'Radial Report Template');

    const templateRows = templates.map(t => [
      'Radial Report Template',
      t.id,
      t.name,
      t.config || '',
      t.innerRadius?.toString() || '50',
      t.outerRadius?.toString() || '250'
    ]);

    const newRows = [...filteredRows, ...templateRows];

    await this.sheetsRequest(components.rootDataId, '/values/A:Z:clear', { method: 'POST' });
    await this.sheetsRequest(components.rootDataId, '/values/A1?valueInputOption=USER_ENTERED', {
      method: 'PUT',
      body: JSON.stringify({ values: newRows })
    });
  }

  async addCompetency(competency = {}) {
    const components = await this.resolveProjectComponents();
    if (!components || !components.rootDataId) throw new Error("Root Data spreadsheet not found.");

    const id = competency.id || `comp_${Date.now()}`;
    const name = competency.name || 'New Competency';
    const relatedIdsList = competency.relatedIds || [];
    const relatedIds = relatedIdsList.join(';');
    const state = competency.state || 'ACTIVE';
    const rank = competency.rank !== undefined ? competency.rank.toString() : '0';
    const description = competency.description || '';
    const rubric = competency.rubric || '';
    const color = competency.color || '#94a3b8';

    const row = [
      'Competency',
      id,
      name,
      relatedIds,
      state,
      rank,
      description,
      rubric,
      color
    ];

    await this.sheetsRequest(components.rootDataId, '/values/A1:append?valueInputOption=USER_ENTERED', {
      method: 'POST',
      body: JSON.stringify({ values: [row] })
    });

    return {
      id,
      name,
      relatedIds: relatedIdsList,
      state,
      rank: parseFloat(rank),
      description,
      rubric,
      color
    };
  }

  async retireCompetency(competencyId) {
    if (!competencyId) throw new Error("competencyId is required for retireCompetency.");
    const components = await this.resolveProjectComponents();
    if (!components || !components.rootDataId) throw new Error("Root Data spreadsheet not found.");

    const data = await this.sheetsRequest(components.rootDataId, '/values/A:Z');
    const existingRows = data.values || [];
    let updated = false;

    const newRows = existingRows.map(row => {
      if ((row[0] === 'Competency' || row[0] === 'Goal') && row[1] === competencyId) {
        const copy = [...row];
        copy[5] = 'RETIRED';
        updated = true;
        return copy;
      }
      return row;
    });

    if (!updated) return false;

    await this.sheetsRequest(components.rootDataId, '/values/A:Z:clear', { method: 'POST' });
    await this.sheetsRequest(components.rootDataId, '/values/A1?valueInputOption=USER_ENTERED', {
      method: 'PUT',
      body: JSON.stringify({ values: newRows })
    });

    return true;
  }

  async saveLinkedClassrooms(classrooms = []) {
    if (!Array.isArray(classrooms)) {
      throw new Error("classrooms must be an Array of classroom objects.");
    }
    const components = await this.resolveProjectComponents();
    if (!components || !components.rootDataId) throw new Error("Root Data spreadsheet not found.");

    const data = await this.sheetsRequest(components.rootDataId, '/values/A:Z');
    const existingRows = data.values || [];
    const otherRows = existingRows.filter(row => row[0] !== 'Google Classroom' && row[0] !== 'Classroom');

    const classroomRows = classrooms.map(c => ['Google Classroom', c.id, c.name || 'Unknown']);

    const newRows = [...otherRows, ...classroomRows];

    await this.sheetsRequest(components.rootDataId, '/values/A:Z:clear', { method: 'POST' });
    await this.sheetsRequest(components.rootDataId, '/values/A1?valueInputOption=USER_ENTERED', {
      method: 'PUT',
      body: JSON.stringify({ values: newRows })
    });
  }

  async addEvidenceAndObservations(learnerId, evidence, observations = [], files = []) {
    const uploadedFiles = [];
    if (files && files.length > 0) {
      const components = await this.resolveProjectComponents();
      for (const file of files) {
        const uploadResult = await this.uploadFileToDrive(file, components?.folderId ? [components.folderId] : []);
        uploadedFiles.push(uploadResult);
      }
    }

    let artifactsFolderId = null;
    const rootData = await this.readRootData();
    if (rootData && rootData.Student) {
      const student = rootData.Student.find(s => s.learnerDataId === learnerId);
      if (student) artifactsFolderId = student.artifactsId;
    }

    const copiedArtifactIds = [];
    if (artifactsFolderId && uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        const copy = await this.driveRequest(`/files/${file.id}/copy?supportsAllDrives=true`, {
          method: 'POST',
          body: JSON.stringify({
            parents: [artifactsFolderId],
            name: `${evidence.name} - ${file.name}`
          })
        });
        copiedArtifactIds.push(copy.id);
      }
    }

    const ratingsString = observations.map(o => `${o.competencyId},${o.rating}`).join(';');
    const existingArtifactIds = evidence.artifactIds || [];
    const allArtifactIds = [...copiedArtifactIds, ...existingArtifactIds];
    const artifactIdsString = allArtifactIds.join(';');

    const evidenceRow = [
      'Evidence',
      evidence.id || Date.now().toString(),
      evidence.name,
      ratingsString,
      artifactIdsString,
      evidence.note || '',
      evidence.timestamp || new Date().toISOString(),
      evidence.authorEmail || ''
    ];

    const rowsToAppend = [evidenceRow];

    observations.forEach(o => {
      rowsToAppend.push([
        'Observation',
        o.id || Date.now().toString(),
        o.competencyId,
        o.authorEmail || evidence.authorEmail || '',
        o.rating,
        o.timestamp || evidence.timestamp || new Date().toISOString()
      ]);
    });

    await this.sheetsRequest(learnerId, '/values/A1:append?valueInputOption=USER_ENTERED', {
      method: 'POST',
      body: JSON.stringify({ values: rowsToAppend })
    });
  }

  async addAssessment(learnerId, assessment) {
    const assessmentRow = [
      'Assessment',
      assessment.id || Date.now().toString(),
      assessment.assessmentGroupId || '',
      assessment.competencyId,
      assessment.assessorEmail || '',
      assessment.rating !== undefined ? assessment.rating : '',
      assessment.summativeNote || '',
      assessment.guidance || '',
      assessment.timestamp || new Date().toISOString()
    ];

    await this.sheetsRequest(learnerId, '/values/A1:append?valueInputOption=USER_ENTERED', {
      method: 'POST',
      body: JSON.stringify({ values: [assessmentRow] })
    });
  }
}

export class UIPrefs {
  constructor() {
    this._accessToken = '';
    this.USER_EMAIL_KEY = 'clk_user_email';
    this.COMPETENCY_USAGE_KEY = 'clk_competency_usage';
    this.LEGACY_GOAL_USAGE_KEY = 'clk_goal_usage';
    this.ASSIGNMENT_COMPETENCIES_KEY = 'clk_assignment_competencies';
    this.LEGACY_ASSIGNMENT_GOALS_KEY = 'clk_assignment_goals';
    this.STUDENT_USAGE_KEY = 'clk_student_usage';
    this.FOLDER_ID_KEY = 'clk_folder_id';
    this.ROOT_DATA_ID_KEY = 'clk_root_data_id';
    this.LEARNERS_FOLDER_ID_KEY = 'clk_learners_folder_id';
  }

  getAccessToken() {
    return this._accessToken || sessionStorage.getItem('clk_access_token') || null;
  }

  setAccessToken(token) {
    this._accessToken = token || '';
    if (token) {
      sessionStorage.setItem('clk_access_token', token);
    } else {
      sessionStorage.removeItem('clk_access_token');
    }
  }

  clearAccessToken() {
    this._accessToken = '';
    sessionStorage.removeItem('clk_access_token');
  }

  getUserEmail() {
    return localStorage.getItem(this.USER_EMAIL_KEY);
  }

  setUserEmail(email) {
    email
      ? localStorage.setItem(this.USER_EMAIL_KEY, email)
      : localStorage.removeItem(this.USER_EMAIL_KEY);
  }

  clearUserEmail() {
    localStorage.removeItem(this.USER_EMAIL_KEY);
  }

  initTokenClient(oauth2, config = {}) {
    return oauth2.initTokenClient({
      client_id: config.clientId ?? config.client_id,
      scope: config.scope ?? config.scopes,
      callback: (resp) => {
        if (resp.access_token) {
          this.setAccessToken(resp.access_token);
          if (resp.login_hint) this.setUserEmail(resp.login_hint);
        }
        config.callback?.(resp);
      }
    });
  }

  requestAccessToken(tokenClient, options = {}) {
    tokenClient.requestAccessToken({
      hint: options.hint ?? (this.getUserEmail() || undefined),
      prompt: options.prompt ?? (options.interactive === false ? '' : options.interactive === true ? 'consent' : undefined)
    });
  }

  getProjectComponentIds() {
    const folderId = localStorage.getItem(this.FOLDER_ID_KEY);
    const rootDataId = localStorage.getItem(this.ROOT_DATA_ID_KEY);
    const learnersFolderId = localStorage.getItem(this.LEARNERS_FOLDER_ID_KEY);
    return (folderId || rootDataId || learnersFolderId)
      ? { folderId: folderId ?? '', rootDataId: rootDataId ?? '', learnersFolderId: learnersFolderId ?? '' }
      : null;
  }

  setProjectComponentIds(ids = {}) {
    ids.folderId && localStorage.setItem(this.FOLDER_ID_KEY, ids.folderId);
    ids.rootDataId && localStorage.setItem(this.ROOT_DATA_ID_KEY, ids.rootDataId);
    ids.learnersFolderId && localStorage.setItem(this.LEARNERS_FOLDER_ID_KEY, ids.learnersFolderId);
  }

  clearProjectComponentIds() {
    localStorage.removeItem(this.FOLDER_ID_KEY);
    localStorage.removeItem(this.ROOT_DATA_ID_KEY);
    localStorage.removeItem(this.LEARNERS_FOLDER_ID_KEY);
  }

  recordCompetencyUsage(competencyIds, evidenceName) {
    const usage = JSON.parse(localStorage.getItem(this.COMPETENCY_USAGE_KEY) || localStorage.getItem(this.LEGACY_GOAL_USAGE_KEY) || '{}');
    const now = Date.now();
    competencyIds.forEach(id => { usage[id] = now; });
    localStorage.setItem(this.COMPETENCY_USAGE_KEY, JSON.stringify(usage));

    const assignmentCompetencies = JSON.parse(
      localStorage.getItem(this.ASSIGNMENT_COMPETENCIES_KEY) || localStorage.getItem(this.LEGACY_ASSIGNMENT_GOALS_KEY) || '{}'
    );
    assignmentCompetencies[evidenceName.toLowerCase()] = { competencyIds, timestamp: now };
    localStorage.setItem(this.ASSIGNMENT_COMPETENCIES_KEY, JSON.stringify(assignmentCompetencies));
  }

  getRecentCompetencyIds(timeWindowMs = 365 * 24 * 60 * 60 * 1000) {
    const usage = JSON.parse(localStorage.getItem(this.COMPETENCY_USAGE_KEY) || localStorage.getItem(this.LEGACY_GOAL_USAGE_KEY) || '{}');
    const cutoff = Date.now() - timeWindowMs;
    return Object.keys(usage).filter(id => usage[id] > cutoff);
  }

  getCompetenciesForAssignment(evidenceName) {
    if (!evidenceName) return [];
    const assignmentCompetencies = JSON.parse(
      localStorage.getItem(this.ASSIGNMENT_COMPETENCIES_KEY) || localStorage.getItem(this.LEGACY_ASSIGNMENT_GOALS_KEY) || '{}'
    );
    const data = assignmentCompetencies[evidenceName.toLowerCase()];
    const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
    return data && data.timestamp >= oneYearAgo ? (data.competencyIds || data.goalIds || []) : [];
  }

  recordStudentUsage(studentIds) {
    const usage = JSON.parse(localStorage.getItem(this.STUDENT_USAGE_KEY) || '{}');
    const now = Date.now();
    studentIds.forEach(id => { usage[id] = now; });
    localStorage.setItem(this.STUDENT_USAGE_KEY, JSON.stringify(usage));
  }

  getRecentStudentIds(timeWindowMs = 365 * 24 * 60 * 60 * 1000) {
    const usage = JSON.parse(localStorage.getItem(this.STUDENT_USAGE_KEY) || '{}');
    const cutoff = Date.now() - timeWindowMs;
    return new Set(Object.keys(usage).filter(id => usage[id] > cutoff));
  }
}
