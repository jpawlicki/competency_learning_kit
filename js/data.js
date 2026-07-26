/**
 * data.js contains interfaces for reading and writing data to persistent storage.
 *
 * The default backend storage solution is Google Drive, with cached data in browser-local and session storage.
 */

// PUBLIC INTERFACES

// Create a new storage hooked up to Google Drive.
export function createStorageGoogleDrive() {
  return new StorageGoogleDrive();
}

export class Storage {
  // Block direct instantiation.
  constructor() { if (this.constructor === Storage) throw new Error("Do not instantiate a Storage directly - use a factory instead."); }

  // Read the entire root datastore into memory; returns the datastore as a dictionary.
  // Non-singleton rows are valued as an array even if they have only one value.
  readRootData() { throw new Error("Not implemented in superclass."); }

  // Read the entire learner datastore for learner `id` into memory, returning it as a dictionary.
  // Non-singleton rows are valued as an array even if they have only one value.
  readLearnerData(id) { throw new Error("Not implemented in superclass."); }

  // Create the root data spreadsheet.
  initializeData(institutionName) { throw new Error("Not implemented in superclass."); }

  // Add a learner.
  addLearner() { throw new Error("Not implemented in superclass."); }

  // Add observations and 
  addEvidenceAndObservations() { throw new Error("Not implemented in superclass."); }
}

export class StorageGoogleDrive implements Storage {
  // TODO
}
