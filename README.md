# Competency Learning Kit

## Overview

Competency Learning Kit ("CLK") is free and open-source software for running
[competency-based
learning](https://en.wikipedia.org/wiki/Competency-based_learning) programs.
CLK's mission is:
  1. To enable institutions to track learners' progress toward mastering
     competencies
  2. and share that progress with the learner and their advocates
  3. while remaining completely free, low-risk, and easy-to-adopt.

CLK can be accessed [online](https://competency-learning-kit.com).

Although CLK was developed to aid a specific K-8 educational institution, it is
useful anywhere a competency-based learning program exists, even in the
business setting.

Before using CLK, institutions should find a way to define the "competency
architecture" that learners will develop. These will need to be set up
within CLK one time.

Throughout the learning journey, users add **observations** into the system.
An observation might just be a simple note about a behavior, or linked to an
assignment, test, project, or other artifact. Each observation is about a
competency and has a score of 1.0 (a learner demonstrated the competency), a
score of 0.0 (a learner failed to demonstrate the competency), or a score
in-between (a partial demonstration of the competency). Each uploaded artifact
or note can be associated with multiple observations.

At any time, assessors can "roll up" recent observations into an **assessment**
of a learner's competency. When assessing the competency, the assessor is
presented with the previous assessment (and any notes/feedback associated with
it) and all relevant observations since then. The assessor then scores the
competency as "not yet developing/demonstrating", "developing or sometimes
demonstrates", "consistently demonstrates", and provides a summative statement
about the learner's development so far and future guidance.

Multiple assessors may evaluate the same learner and competency, and reach
different findings. Divergent assessments are normal and a valid piece of the
learner's story, and may reveal nuance and key context around the learner's
competencies.

Assessments should be **shared** with the learner and their advocates. CLK can
produce a printable report for a learner as well as a web page to which the
learner and their advocates can be granted access. By default, individual
observations are not included in these reports, though CLK provides an option
to show observations as well.

Replacing a traditional grading system with a competency-based learning program
is a substantial change. To help ease the transition, CLK allows institutions
to create "competency groups" that can provide specific alternative views of
competencies. This allows an instutition to create alternative views of
progress, for example by course or teacher.

## Getting Started (Educators)

## Competencies

Competencies can be very fine-grained or coarse-grained. For example, a grade 1
teacher may wish to individually assess students' capability to add numbers
separately from their capability to subtract numbers. However, a higher-grade
teacher may wish to represent these capabilities (and others) more broadly as a
single "math facts" competency. To support both educators, competencies can be
freely sub-divided into other competencies and freely grouped up into more
coarse competencies.

Competencies can also be marked as **foundations** for other competencies. This
allows clearer communication about how competencies relate to each other.

Educators may need to revise competencies as time goes on and programs change.
Competencies can be **retired**, and their replacements marked with **related
competencies** to provide continuity across such transitions.

## Project Structure

To avoid the complicated regulatory environment surrounding children's data,
CLK stores all data in a Google Drive folder ("Competency Learning Kit Data")
owned by the educator. The web pages run client-side logic to read, modify, and
write the data back to Google Drive. (Since educational institutions often
already have Google Workspace integrations, and often already store children's
data in Drive, this design often allows an educator to adopt CLK without
additional legal hurdles. It also eliminates any risk of the CLK project itself
holding sensitive data.)

The data is organized in Google Drive as follows:
  - `Competency Learning Kit Data` (a folder)
      - `Root Data` (a spreadsheet)
      - `Learners` (a folder)
          - `Ruby Bridges` (example; a student's folder)
              - `Ruby Bridges (Learner Data)` (a spreadsheet)
              - `Ruby Bridges (Artifacts)` (a folder)
                  - `Book Report - Charlotte's Web` (a document)

### The Root Data Spreadsheet

The Root Data spreadsheet serves as an extensible dictionary that can be used
to locate other artifacts. The first column of each row of the spreadsheet
names the semantic data type, and subsequent columns provide additional
information depending on the type. For "singleton" rows, the lowest row in the
document is the source of truth. Recognized types and subsequent columns are:
  - `Comment`: A comment string for humans who find the spreadsheet.
  - `Institution Name` (singleton): The name of the institution.
  - `Global Write Permission`: An e-mail address of an account that should have
    write permission for all CLK data.
  - `Global Read Permission`: An e-mail address of an account that should have
    read permission for all CLK data.
  - `Student`: The name of a student, the ID of that student's folder, the ID
    of that student's Learner Data spreadsheet, the ID of that student's
    Artifacts folder, the current display name of the student (allowing for
    nicknaming), the student's Google Classroom ID (if any).
  - `Google Classroom`: The ID of a Google Classroom linked with this system.
  - `Competency`: A unique ID, the name of the competency, a
    semicolon-separated list of related competencies, the competency's state
    ("RETIRED" or "ACTIVE"), a numeric rank for the competency (used when
    ordering a list of competencies in UI elements), a long-form description of
    the competency, rubric text for what meeting the competency means, a color
    for the competency (as a #-prefixed 6-digit hexadecimal code).
  - `Competency Group`: A unique ID, the name of the competency group, a
    semicolon-separated list of competencies, a long-form description of the
    competency group.
  - `Learner Group`: A unique ID, the name of a learner group, a long-form
    description of the competency group.
  - `Radial Report Template`: A unique ID, the name of the report template, a
    semicolon-separated list of colon-separated lists of number-sign-separated
    unique-ID#anchor pairs where the unique ID is a competency's ID. The
    outermost list defines the layers of a sunburst diagram, while the inner
    list defines the elements in that layer in clockwise order starting from
    north. The anchors in the first (innermost) layer of the ring are 0 and are
    ignored. The anchors in each subsequent layer refer to an index into the
    inner list of the previous layer of the ring, and indicate that this
    competency should be rendered in a subslice of that competency. The next
    columns are the inner and outer radii of the annulus.

### The Learner Data Spreadsheet

The Learner Data spreadsheet serves as an extensible dictionary that contains
learner-specific data. The design is similar to the Root Data spreadsheet but
the types are different:
  - `Comment`: A comment string for humans who find the spreadsheet.
  - `Student Name` (singleton): the name of the student (a checksum; the Root Data
    spreadsheet is authoritative).
  - `Group`: The unique ID of a learner group to which this learner belongs.
  - `Read Permission`: An e-mail address of an account that should be able to
    read data about this specific learner (e.g. a parent/guardian's e-mail).
    This need not repeat accounts from the Global Read Permission.
  - `Write Permission`:  An e-mail address of an account that should be able to
    write data about this specific learner (e.g. a trusted tutor). This need
    not repeat accounts from the Global Write Permission.
  - `Evidence`: A unique ID, the name of a piece of evidence representing
    progress toward a competency, a semicolon-separated list of resulting observations,
    a semicolon-separated list of Drive document IDs (artifacts) providing the
    evidence, an educator's note / comment (a string), a timestamp of entry,
    the account (e-mail) of the person entering the evidence.
  - `Observation`: A unique ID, the competency ID, the e-mail address of the
    user who entered the observation, the competency rating (0.0 to 1.0), the
    timestamp of entry, the visibility of the observation (PRIVATE,
    INSTITUTION, ALL).
  - `Assessment`: A unique ID, an assessment group ID, a competency ID, the
    e-mail address of the assessor, the rating (0.0 to 1.0, with 0 interpreted
    as "not yet demonstrates" and 1.0 as "consistently demonstrates" and values
    between interpreted as "sometimes demonstrates"), a summative note, helpful
    guidance, a timestamp of entry.

#### Additional Details

Assessments carry a single assessment group ID. This is used when multiple assessments
(e.g. from multiple educators) should logically be reported as a single assessment with
multiple voices. If the assessments have divergent ratings, the overall assessment is
reported as the average of the ratings.

## Development Topics

Developers (including AI agents) should also consult [AGENTS.md](./AGENTS.md).

