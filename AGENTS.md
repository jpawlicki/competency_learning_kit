# Instructions for Developers and Agents

Contributors (human or otherwise) should follow these guidelines:

  - Always review the README.md file. The README contains up-to-date specifications of data structures and the overall project design.
  - Avoid nullability where possible. Null return values are generally permitted but null inputs are not.
  - Avoid default and optional arguments where possible.
  - Avoid polymorphism where possible. We prefer strict and documented type assumptions.
     - Generally, it's not necessary to check that the caller provided the right types, and instead rely on JavaScript duck typing.
  - Prefer dependency injection and composition to inheritance or globals.
     - This enables the easy injection of fakes and creation of unit tests.
  - Avoid over-verbosity.
  - Prefer functional implementation patterns.
     - Prefer expressions to statements.
     - Minimize local variable use.
     - Minimize if statements, preferring null coalescing, ternaries, etc.
     - Nevertheless, when if statements are proper, use them.
  - Where departing from the above instructions has substantial benefit, depart from the above instructions.
