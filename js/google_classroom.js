/**
 * google_classroom.js contains interfaces and functions for interacting with Google Classroom.
 */

import { createUIPrefsBrowserStorage } from './data.js';

// PUBLIC INTERFACES

/**
 * Create a new GoogleClassroom service instance.
 * @param {UIPrefs} [uiPrefs] - UIPrefs instance for access token composition.
 * @returns {GoogleClassroomService}
 */
export function createGoogleClassroom(uiPrefs = createUIPrefsBrowserStorage()) {
  return new GoogleClassroomService(uiPrefs);
}

export class GoogleClassroom {
  // Block direct instantiation.
  constructor() {
    if (this.constructor === GoogleClassroom) {
      throw new Error("Do not instantiate a GoogleClassroom directly - use a factory instead.");
    }
  }

  /**
   * Fetch active Google Classroom courses accessible by the authenticated user.
   * @returns {Promise<Array<Object>>} List of active course objects.
   */
  fetchClassrooms() {
    throw new Error("Not implemented in superclass.");
  }

  /**
   * Fetch the student roster for a specific Google Classroom course.
   * @param {string} courseId - Google Classroom course ID.
   * @returns {Promise<Array<Object>>} List of student profile objects.
   */
  fetchCourseRoster(courseId) {
    throw new Error("Not implemented in superclass.");
  }

  /**
   * Import students from selected Google Classroom courses into CLK, skipping existing students.
   * @param {Array<string>} courseIds - List of course IDs to import from.
   * @param {Array<Object>} existingStudents - Currently registered CLK student objects.
   * @param {Object} [storageInstance] - Optional Storage instance to invoke addLearner on.
   * @returns {Promise<Object>} Summary of imported count and skipped count.
   */
  importStudentsFromClassrooms(courseIds, existingStudents = [], storageInstance = null) {
    throw new Error("Not implemented in superclass.");
  }

  /**
   * Fetch coursework / assignments for a specific Google Classroom course.
   * @param {string} courseId - Google Classroom course ID.
   * @returns {Promise<Array<Object>>} List of coursework objects.
   */
  fetchCourseWork(courseId) {
    throw new Error("Not implemented in superclass.");
  }

  /**
   * Create a new coursework assignment in a Google Classroom course.
   * @param {string} courseId - Google Classroom course ID.
   * @param {string} title - Assignment title.
   * @param {Object} [options] - Additional assignment parameters (workType, state, description, etc.).
   * @returns {Promise<Object>} Created coursework object.
   */
  createCourseWork(courseId, title, options = {}) {
    throw new Error("Not implemented in superclass.");
  }

  /**
   * Update or sync a student's assigned and draft grade for a coursework submission.
   * @param {string} courseId - Google Classroom course ID.
   * @param {string} courseWorkId - Coursework assignment ID.
   * @param {string} userId - Student's Google Classroom user ID or email.
   * @param {number} grade - Numeric grade value to set.
   * @returns {Promise<Object>} Updated submission object.
   */
  syncStudentGrade(courseId, courseWorkId, userId, grade) {
    throw new Error("Not implemented in superclass.");
  }
}


// IMPLEMENTATIONS

export class GoogleClassroomService extends GoogleClassroom {
  constructor(uiPrefs = createUIPrefsBrowserStorage()) {
    super();
    this.uiPrefs = uiPrefs;
  }

  getAccessToken() {
    return this.uiPrefs.getAccessToken();
  }

  async classroomRequest(path, options = {}) {
    const token = this.getAccessToken();
    if (!token) throw new Error("Google Classroom access token not set.");
    const url = `https://classroom.googleapis.com/v1${path}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      if (response.status === 401) window.dispatchEvent(new CustomEvent('clk-auth-error'));
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Classroom API request failed (${response.status})`);
    }

    return response.status === 204 ? null : response.json();
  }

  async fetchClassrooms() {
    const data = await this.classroomRequest('/courses?courseStates=ACTIVE');
    return data.courses || [];
  }

  async fetchCourseRoster(courseId) {
    const data = await this.classroomRequest(`/courses/${courseId}/students`);
    return data.students || [];
  }

  async importStudentsFromClassrooms(courseIds, existingStudents = [], storageInstance = null) {
    let importedCount = 0;
    let skippedCount = 0;

    for (const courseId of courseIds) {
      const students = await this.fetchCourseRoster(courseId);
      for (const cs of students) {
        const fullName = cs.profile?.name?.fullName || 'Unknown';
        const exists = existingStudents.find(s => s.name === fullName || s.classroomId === cs.userId);
        if (exists) {
          if (!exists.classroomId) {
            // Link them
            await storageInstance?.linkLearnerToClassroom(exists.name, cs.userId);
            exists.classroomId = cs.userId; // update local copy so we don't try again
          }
          skippedCount++;
          continue;
        }

        await storageInstance?.addLearner(fullName, fullName, cs.userId);
        importedCount++;
      }
    }

    return { importedCount, skippedCount };
  }

  async fetchCourseWork(courseId) {
    const data = await this.classroomRequest(`/courses/${courseId}/courseWork`);
    return data.courseWork || [];
  }

  async createCourseWork(courseId, title, options = {}) {
    const body = {
      title,
      workType: options.workType ?? 'ASSIGNMENT',
      state: options.state ?? 'PUBLISHED',
      ...options
    };

    return await this.classroomRequest(`/courses/${courseId}/courseWork`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async syncStudentGrade(courseId, courseWorkId, userId, grade) {
    const subData = await this.classroomRequest(`/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions?userId=${userId}`);
    const submissions = subData.studentSubmissions || [];

    if (submissions.length === 0) {
      throw new Error(`No student submission found for user ${userId} on coursework ${courseWorkId}`);
    }

    const submission = submissions[0];
    const numericGrade = parseFloat(grade);

    return await this.classroomRequest(
      `/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions/${submission.id}?updateMask=assignedGrade,draftGrade`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          assignedGrade: numericGrade,
          draftGrade: numericGrade
        })
      }
    );
  }
}
