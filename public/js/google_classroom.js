/**
 * google_classroom.js contains interfaces and functions for interacting with Google Classroom.
 */

import { createUIPrefsBrowserStorage } from './data.js';

/**
 * Create a new GoogleClassroom service instance.
 * @param {UIPrefs} [uiPrefs] - UIPrefs instance for access token composition.
 * @returns {GoogleClassroom}
 */
export function createGoogleClassroom(uiPrefs = createUIPrefsBrowserStorage()) {
  return new GoogleClassroom(uiPrefs);
}

export class GoogleClassroom {
  constructor(uiPrefs = createUIPrefsBrowserStorage()) {
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

  /**
   * Fetch active Google Classroom courses accessible by the authenticated user.
   * @returns {Promise<Array<Object>>} List of active course objects.
   */
  async fetchClassrooms() {
    const data = await this.classroomRequest('/courses?courseStates=ACTIVE');
    return data.courses || [];
  }

  /**
   * Fetch the student roster for a specific Google Classroom course.
   * @param {string} courseId - Google Classroom course ID.
   * @returns {Promise<Array<Object>>} List of student profile objects.
   */
  async fetchCourseRoster(courseId) {
    const data = await this.classroomRequest(`/courses/${courseId}/students`);
    return data.students || [];
  }

  /**
   * Import students from selected Google Classroom courses into CLK, skipping existing students.
   * @param {Array<string>} courseIds - List of course IDs to import from.
   * @param {Array<Object>} existingStudents - Currently registered CLK student objects.
   * @param {Object} [storageInstance] - Optional Storage instance to invoke addLearner on.
   * @returns {Promise<Object>} Summary of imported count and skipped count.
   */
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

        await storageInstance?.addLearner(fullName, cs.userId);
        importedCount++;
      }
    }

    return { importedCount, skippedCount };
  }

  /**
   * Fetch coursework / assignments for a specific Google Classroom course.
   * @param {string} courseId - Google Classroom course ID.
   * @returns {Promise<Array<Object>>} List of coursework objects.
   */
  async fetchCourseWork(courseId) {
    const data = await this.classroomRequest(`/courses/${courseId}/courseWork`);
    return data.courseWork || [];
  }

  /**
   * Create a new coursework assignment in a Google Classroom course.
   * @param {string} courseId - Google Classroom course ID.
   * @param {string} title - Assignment title.
   * @param {Object} [options] - Additional assignment parameters (workType, state, description, etc.).
   * @returns {Promise<Object>} Created coursework object.
   */
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

  /**
   * Update or sync a student's assigned and draft grade for a coursework submission.
   * @param {string} courseId - Google Classroom course ID.
   * @param {string} courseWorkId - Coursework assignment ID.
   * @param {string} userId - Student's Google Classroom user ID or email.
   * @param {number} grade - Numeric grade value to set.
   * @returns {Promise<Object>} Updated submission object.
   */
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
