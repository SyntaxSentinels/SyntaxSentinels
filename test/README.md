# Testing

This folder contains sample source code for testing the plagiarism detection system.

## Hand-Written Sample Source Code

The following folders contain hand-written solutions, crafted to demonstrate potential plagiarism cases.

- FrogJump
- NumberOfIslands
- NumberOfPaths
- TwoSum

## Frontend and Automated Tests

### Automated Tests
In the AutomatedTests folder is a script that tests that the functional requirements are met. To run the script, use the following command:

```bash
cd test/AutomatedTests
python gui_fr_test.py
```

### Frontend Tests

Frontend tests exist within src/frontend. To run the frontend tests, use the following commands:

```bash
cd src/frontend
npm install
npm test
```

These tests are automatically ran for every commit, and the results are displayed in the pull request as a comment by a bot.
