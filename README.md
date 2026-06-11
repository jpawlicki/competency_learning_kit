# Open Proficiency Learning

## Overview

Open Proficiency Learning ("OPL", pronounced "Opal") is a free and open source
gradebook solution for proficiency-based learning (also called "mastery
learning" or "competancy learning"). OPL's goal is to create a free and
lightweight solution for educators to collectively enter and track information
about students' progress toward milestones, while not adding to the educational
instution's legal or compliance burdens.

## Getting Started (Educators)

## Getting Started (Project Contributors)

## Project Structure

To avoid the complicated regulatory environment surrounding children's data,
OPL stores all data in a Google Drive folder ("Open Proficiency Learning Data")
owned by the educator. The web pages run client-side logic to read, modify, and
write the data back to Google Drive. (Since educational instutitions often
already have Google Workspace integrations, and often already store children's
data in Drive, this design often allows an educator to adopt OPL without
additional legal hurdles. It also eliminates any risk of the OPL project itself
holding sensitive data.)

The data is organized in Google Drive as follows:
  - `Open Proficiency Learning Data` (a folder)
      - `Root Data` (a spreadsheet)
      - `Learners` (a folder)
          - `Ruby Bridges` (example; a student's folder)
              - `Learner Data` (a spreadsheet)
              - `Artifacts` (a folder)
                  - `Book Report - Charlotte's Web` (a document)

### The Root Data Spreadsheet

The Root Data spreadsheet serves as an extensible dictionary that can be used
to locate other artifacts. The first column of each row of the spreadsheet
names the semantic data type, and subsequent columns provide additional
information depending on the type. For "singleton" rows, the lowest row in the
document is the source of truth. Recognized types and subsequent columns are:
  - `Comment`: A comment string for humans who find the spreadsheet.
  - `Institution Name` (singleton): The name of the educational institution.
  - `Global Write Permission`: An e-mail address of an account that should have
    write permission for all OPL data.
  - `Global Read Permission`: An e-mail address of an account that should have
    read permission for all OPL data.
  - `Student`: The name of a student, the ID of that student's folder, the ID
    of that student's Learner Data spreadsheet, the ID of that student's
    Artifacts spreadsheet.
  - `Goal`: A unique ID, the name of a milestone (competancy, ability, etc),
    the parent goal (by ID, -1 if top-level), the beginning level of the goal
    (e.g. 4.5 for a goal generally expected to be started halfway through 4th
    grade, used as the inner radius when rendering in polar coordinates), the
    ending level of the goal (e.g. 8.5 for a goal generally expected to be
    ended halfway through 8th grade, used as the outer radius when rendering in
    polar coordinates), a "position" of the goal (theta; radians for rendering
    in polar coordinates, in terms of offset from the position of the parent
    goal, or from north if no parent), "width" of the goal (in radians), a
    long-form description of the goal, rubric text for what meeting the goal
    means, a color for the goal (as a #-prefixed 6-digit hexadecimal code).

### The Learner Data Spreadsheet

The Learner Data spreadsheet serves as an extensible dictionary that contains
learner-specific data. The design is similar to the Root Data spreadsheet but
the types are different:
  - `Comment`: A comment string for humans who find the spreadsheet.
  - `Student Name`: the name of the student (a checksum; the Root Data
    spreadsheet is authoritative).
  - `Read Permission`: An e-mail address of an account that should be able to
    read data about this specific learner (e.g. a parent/guardian's e-mail).
    This need not repeat accounts from the Global Read Permission.
  - `Write Permission`:  An e-mail address of an account that should be able to
    write data about this specific learner (e.g. a trusted tutor). This need
    not repeat accounts from the Global Write Permission.
  - `Evidence`: A unique ID, the name of a piece of evidence representing
    progress toward a goal, a semi-colon-separated list of (goal-id, rating)
    pairs that the evidence counts towards, a semi-colon-separated list of
    Drive document IDs (artifacts) providing the evidence, an educator's note /
    comment (a string), a timestamp of entry, comma-separated list of IDs that
    this evidence replaces or supercedes, the account (e-mail) of the person
    entering the evidence, the timestamp it was archived, the account (e-mail)
    of the person who archived it. Ratings are in the form of a numeric score
    from 0 to 100.

## Development

## License
