Create a new QBO module named "$1". Follow the module-template skill exactly:
1. Create backend file: functions/modules/$1/index.js
2. Create frontend component: frontend/src/components/modules/$1/index.jsx  
3. Add route in functions/api/routes.js
4. Add navigation tab in AppLayout.jsx
5. Use the qbo-api-developer subagent for the API integration
6. Use the frontend-builder subagent for the React component
7. Test with the module-tester subagent
