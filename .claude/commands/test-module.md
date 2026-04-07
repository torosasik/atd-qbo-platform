Test the "$1" module thoroughly using the module-tester subagent:
1. Validate all input fields (required, optional, edge cases)
2. Test QBO API payload generation with sample data
3. Test error handling (invalid vendor, missing items, QBO errors)
4. Test AI review integration (Ollama available, Ollama down, both down)
5. Verify Firestore logging for success and failure cases
6. Check frontend form validation
7. Report findings with pass/fail for each test
