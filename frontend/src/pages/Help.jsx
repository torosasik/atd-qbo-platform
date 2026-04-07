import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, ChevronDown, ChevronRight, ArrowUp, BookOpen, Rocket, Wrench } from 'lucide-react';

// ---------------------------------------------------------------------------
// Content Data
// ---------------------------------------------------------------------------

const TABS = [
  {
    id: 'quick-start',
    label: 'Quick Start',
    icon: Rocket,
    sections: [
      {
        title: 'Before You Begin',
        content: [
          'Make sure you have the app URL. If you do not have it yet, ask Toros.',
        ],
      },
      {
        title: 'Step 1: Open the App',
        content: [
          'Open Chrome, Safari, or Edge on your computer. Type the app URL into the address bar and press Enter.',
          'You should see the Dashboard page with stat cards at the top and a recent activity table below.',
          'Bookmark the page so you can find it quickly next time.',
        ],
      },
      {
        title: 'Step 2: Check the Dashboard',
        content: [
          'Take a moment to look at the Dashboard.',
          { type: 'list', items: [
            'The Pending Drafts card shows how many POs are waiting for approval.',
            'The Recent Activity table shows the latest actions taken by your team.',
          ]},
          'If the page looks blank or shows an error, go to System Health (in the left sidebar) to check if all services are running. If something shows red, contact Toros before continuing.',
        ],
      },
      {
        title: 'Step 3: Create Your First Purchase Order',
        content: [
          { type: 'list', ordered: true, items: [
            'Click Purchase Orders in the left sidebar.',
            'Click the Create PO tab.',
            'Select a vendor from the dropdown.',
            'The date defaults to today. Change it if needed.',
            'Click Add Row to add your first line item.',
            'Select the item, enter a quantity, and enter the unit price.',
            'Add more rows if this order has multiple items.',
            'Click Submit for Review to save it as a draft for approval.',
          ]},
          'You will see a green confirmation message at the top of the screen when the draft is saved.',
        ],
      },
      {
        title: 'Step 4: Review and Approve the Draft',
        content: [
          { type: 'list', ordered: true, items: [
            'Click the Pending Drafts tab (you should still be in the Purchase Orders section).',
            'Find the draft you just created.',
            'Check that the vendor, items, quantities, and prices are correct.',
            'Click Approve to send the PO to QuickBooks.',
          ]},
          'You will see a confirmation with the QuickBooks PO number once it is approved.',
        ],
      },
      {
        title: 'Step 5: Verify It Appeared in QuickBooks',
        content: [
          { type: 'list', ordered: true, items: [
            'Click the History tab in Purchase Orders.',
            'Find your PO in the list. The Status column should show green.',
            'Note the QBO PO Number shown in the table.',
            'Open QuickBooks Online in another browser tab.',
            'Go to Expenses, then Purchase Orders.',
            'Search for the PO number you noted. It should appear there.',
          ]},
        ],
      },
      {
        title: 'You Are Ready',
        content: [
          'You now know how to create, approve, and verify a Purchase Order. For more detail on any feature, see the User Guide tab.',
          'For problems or questions, contact Toros Asik.',
        ],
      },
    ],
  },
  {
    id: 'user-guide',
    label: 'User Guide',
    icon: BookOpen,
    sections: [
      {
        title: 'What This App Does',
        content: [
          'The ATD QBO Platform automates accounting tasks that would otherwise need to be done manually in QuickBooks Online. Right now the main feature is creating Purchase Orders. Instead of logging into QuickBooks and filling out forms by hand, you can create and approve POs directly from this app, and they are sent to QuickBooks automatically.',
        ],
      },
      {
        title: 'How to Access the App',
        content: [
          'Open any web browser (Chrome, Safari, Edge) and go to the URL that Toros has shared with your team. The app works on desktop computers and laptops. Bookmark it so you can find it easily.',
        ],
      },
      {
        title: 'Dashboard',
        content: [
          'The Dashboard is the first page you see when you open the app. It gives you a quick overview of recent activity.',
          { type: 'heading', text: 'Stat Cards' },
          'At the top of the Dashboard you will see several cards showing numbers:',
          { type: 'list', items: [
            'Pending Drafts: POs that have been created but not yet sent to QuickBooks. These need someone to review and approve them.',
            'POs Today: POs that were approved and sent to QuickBooks today.',
            'AI Reviews Today: AI-assisted reviews completed today.',
          ]},
          { type: 'heading', text: 'Recent Activity Table' },
          'Below the cards is a table showing the most recent actions taken in the platform. Each row shows:',
          { type: 'list', items: [
            'Date and Time: When the action happened.',
            'Action: What was done (for example, "PO Created" or "PO Approved").',
            'Vendor: The vendor the PO was for.',
            'Status: Whether it succeeded or if there was a problem.',
          ]},
        ],
      },
      {
        title: 'Creating a Purchase Order',
        content: [
          { type: 'list', ordered: true, items: [
            'Click Purchase Orders in the left sidebar.',
            'Click the Create PO tab at the top.',
            'Fill in the form:',
          ]},
          'Vendor: Click the dropdown and select the vendor you are ordering from. If you do not see the vendor you need, see the FAQ section.',
          'Date: The date for the purchase order. It defaults to today.',
          'Memo (optional): A short note about this order, such as a project name or reference number.',
          { type: 'heading', text: 'Adding Line Items' },
          'Each line item is one product you are ordering.',
          { type: 'list', items: [
            'Click Add Row to add a new line.',
            'In the Item column, select the product from the dropdown. If the item you need does not exist yet, click "Create new item" to add it directly from the PO form — it will be created in QuickBooks and immediately available for selection.',
            'Enter the Quantity (how many units you are ordering).',
            'Enter the Unit Price (cost per unit). The total for that line calculates automatically.',
            'To remove a line, click the trash icon on the right side of that row.',
          ]},
          { type: 'heading', text: 'Submitting' },
          { type: 'list', items: [
            'Submit for Review: Saves the PO as a draft. A manager will review and approve it before it goes to QuickBooks.',
            'Auto Approve and Submit: Sends the PO directly to QuickBooks without a separate approval step. Use this only if you have permission to approve POs.',
          ]},
        ],
      },
      {
        title: 'Reviewing and Approving Drafts',
        content: [
          'Drafts are POs that have been submitted but not yet sent to QuickBooks. A manager or authorized team member needs to review and approve them.',
          { type: 'list', ordered: true, items: [
            'Click Purchase Orders in the left sidebar.',
            'Click the Pending Drafts tab.',
            'You will see a table of all POs waiting for approval.',
            'To approve a PO, click the Approve button on that row. The PO is sent to QuickBooks and moves to the History tab.',
            'To reject a PO, click the Reject button. The PO is removed from the drafts list and is not sent to QuickBooks.',
          ]},
          'After you click Approve, the PO is created in QuickBooks Online and you will see a confirmation with the QuickBooks PO number.',
        ],
      },
      {
        title: 'Importing from Google Sheets',
        content: [
          'If your team tracks POs in a Google Sheet, you can import them into the platform in bulk instead of creating them one by one.',
          { type: 'list', ordered: true, items: [
            'Click Purchase Orders in the left sidebar.',
            'Click the Import from Sheets tab.',
            'Click Load from Google Sheets. The platform reads the connected spreadsheet and shows you a preview of the data.',
            'Review the data in the preview table. Check that the vendors, items, quantities, and prices look correct.',
            'If everything looks good, click Import All as Drafts. The platform creates one draft PO for each group of rows in the sheet.',
            'Go to the Pending Drafts tab to review and approve the imported POs.',
          ]},
          'Note: The Google Sheet must be set up in the format that Toros has configured. If the import shows no data or shows incorrect data, contact Toros.',
        ],
      },
      {
        title: 'Viewing PO History',
        content: [
          'The History tab shows all POs that have been successfully sent to QuickBooks.',
          { type: 'list', ordered: true, items: [
            'Click Purchase Orders in the left sidebar.',
            'Click the History tab.',
          ]},
          'The table shows:',
          { type: 'list', items: [
            'Date: When the PO was sent to QuickBooks.',
            'QBO PO Number: The ID assigned by QuickBooks. You can use this to find the PO in QuickBooks Online.',
            'Vendor: Who the order is for.',
            'Total: The value of the PO.',
            'Status: Green means it was created successfully. Red means there was a problem.',
          ]},
          'To find a specific PO, scroll through the list or use your browser\'s find function (Ctrl+F on Windows, Command+F on Mac).',
        ],
      },
      {
        title: 'AI Chat',
        content: [
          'The AI Chat is a built-in assistant that can answer questions about your PO data.',
          { type: 'heading', text: 'What You Can Ask' },
          { type: 'list', items: [
            '"Show me today\'s PO activity"',
            '"What vendors do we order from most often?"',
            '"Do we have any duplicate POs this week?"',
            '"How many POs are pending approval?"',
            '"What was the last PO we created for supplier X?"',
          ]},
          { type: 'heading', text: 'AI Source Indicator' },
          'After the AI responds, you may see a small label:',
          { type: 'list', items: [
            'Ollama: The answer came from the local AI running on the ATD server. This is the default and does not use the internet.',
            'Claude: The answer came from a cloud AI service. This is used as a backup when the local AI is unavailable.',
          ]},
          { type: 'heading', text: 'Important Limits' },
          'The AI only sees data inside the ATD QBO Platform. It cannot browse the internet or access QuickBooks directly. It works with the logs and records stored in this app.',
        ],
      },
      {
        title: 'Settings (For Managers Only)',
        content: [
          'The Settings page lets authorized users configure how the platform works. Regular team members do not need to change anything here.',
          { type: 'heading', text: 'Google Sheets' },
          'This section lets you change which Google Sheet the platform reads from when importing POs. If your team moves the data to a new spreadsheet, update the Sheet ID here.',
          { type: 'heading', text: 'AI Settings' },
          { type: 'list', items: [
            'AI Enabled: Turns the AI review feature on or off for the whole platform.',
            'Auto Review: When on, the AI automatically checks each PO before it is submitted.',
            'Minimum Confidence: A number from 0 to 100. Higher means fewer but more reliable flags.',
            'Ollama Model: Which local AI model to use. Leave as is unless Toros says to change it.',
            'Claude Model: Which cloud AI model to use as a backup. Leave as is.',
          ]},
          { type: 'heading', text: 'QBO Settings' },
          { type: 'list', items: [
            'Sandbox: Test mode. POs go to a practice version of QuickBooks, not your real company data.',
            'Production: Live mode. POs go directly to your real QuickBooks company. This is the normal setting for day-to-day use.',
          ]},
          'Always confirm with Toros before switching between Sandbox and Production.',
          { type: 'heading', text: 'Modules' },
          'Each module can be turned on or off independently. Auto Approve sends submissions directly to QuickBooks without waiting for manual approval.',
          { type: 'heading', text: 'Reset to Defaults' },
          'Resets all settings back to the original values. It will not delete any POs or history. Contact Toros before using this if you are unsure.',
        ],
      },
      {
        title: 'Vendor Management',
        content: [
          'The Vendor Management page allows you to sync and manage vendor mappings between QuickBooks Online and your platform.',
          { type: 'heading', text: 'Key Features' },
          { type: 'list', items: [
            'Sync Vendors — Pull the latest vendor list from QuickBooks Online.',
            'Search & Filter — Search vendors by name, Shopify code, or QBO ID.',
            'Activate/Deactivate — Toggle which vendors are available for purchase orders.',
            'Select All / Deselect All — Bulk toggle for filtered vendors.',
            'Shopify Code Mapping — Assign Shopify vendor codes to QBO vendors.',
            'Save Mappings — Save your vendor configuration.',
          ]},
          { type: 'heading', text: 'Getting Started' },
          { type: 'list', ordered: true, items: [
            'Click "Sync from QBO" to pull your vendor list.',
            'Use the search bar to find specific vendors.',
            'Toggle vendors active/inactive as needed.',
            'Enter Shopify codes for vendors that need mapping.',
            'Click "Save Mappings" to persist your changes.',
          ]},
        ],
      },
      {
        title: 'System Health',
        content: [
          'The System Health page shows whether all the pieces of the platform are working correctly.',
          { type: 'heading', text: 'Status Indicators' },
          { type: 'list', items: [
            'Green (Connected / Healthy): Everything is working normally.',
            'Yellow (Degraded / Unavailable): Something is not working perfectly but the main features may still work.',
            'Red (Error / Disconnected): Something is broken and needs attention.',
          ]},
          { type: 'heading', text: 'Services Explained' },
          { type: 'list', items: [
            'Firestore: The database that stores your drafts, logs, and settings. If this is red, the whole app will not work.',
            'QBO API: The connection to QuickBooks Online. If this is red, POs cannot be sent to QuickBooks.',
            'Ollama: The local AI. If yellow or red, AI Chat and AI review will use the cloud backup instead.',
            'Claude API: The cloud AI backup. If "not configured," the API key has not been set up.',
            'Google Sheets: Shows whether a Sheet ID has been configured.',
          ]},
          { type: 'heading', text: 'What to Do If Something Is Red' },
          { type: 'list', ordered: true, items: [
            'Refresh the page and check again.',
            'Check the error message shown under the red service.',
            'If the problem persists, contact Toros with a screenshot of the System Health page.',
          ]},
        ],
      },
      {
        title: 'Frequently Asked Questions',
        content: [
          { type: 'faq', question: 'I submitted a PO but it is not showing up in QuickBooks.', answer: 'Check the Pending Drafts tab. If you used "Submit for Review," the PO is waiting for someone to approve it. It will not appear in QuickBooks until it is approved.' },
          { type: 'faq', question: 'The vendor I need is not in the dropdown.', answer: 'The vendor must exist in QuickBooks Online first. Ask whoever manages your QuickBooks account to add the vendor there. After it is added, a manager can refresh the vendor list in Settings.' },
          { type: 'faq', question: 'The item I need is not in the dropdown.', answer: 'Same as above. The item must exist in QuickBooks Online first. Ask your QuickBooks manager to add it, then refresh the item list in Settings.' },
          { type: 'faq', question: 'I got an error message when submitting a PO.', answer: 'Write down the error message. Try refreshing the page and submitting again. If it happens again, check the System Health page to see if QBO is connected. If QBO shows red, contact Toros.' },
          { type: 'faq', question: 'Can I edit a PO after it has been sent to QuickBooks?', answer: 'No. Once a PO is approved and sent to QuickBooks, it cannot be edited from this platform. You must open QuickBooks Online directly and edit it there.' },
          { type: 'faq', question: 'The AI Chat says it cannot connect or is unavailable.', answer: 'Go to the System Health page. Check the Ollama and Claude API rows. If both are red or unavailable, the AI service is down. The rest of the platform will still work normally. Contact Toros to get the AI back online.' },
          { type: 'faq', question: 'The import from Google Sheets shows no data.', answer: 'Make sure the Google Sheet is set up in the correct format. Check that you are looking at the right tab. Contact Toros to verify the Sheet ID and column mapping are configured correctly.' },
        ],
      },
    ],
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
    icon: Wrench,
    sections: [
      {
        title: 'Page Won\'t Load / Blank Screen',
        content: [
          { type: 'label', text: 'Problem' },
          'You open the app URL and see a blank white page, a loading spinner that never goes away, or a browser error.',
          { type: 'label', text: 'Cause' },
          'The app server may be temporarily offline, or there may be a network issue on your computer.',
          { type: 'label', text: 'Fix' },
          { type: 'list', ordered: true, items: [
            'Wait 30 seconds and refresh the page.',
            'Check your internet connection by opening another website such as google.com.',
            'Try opening the app in a different browser.',
            'Clear your browser cache: in Chrome, press Ctrl+Shift+Delete (Windows) or Command+Shift+Delete (Mac), select "Cached images and files," and click Clear.',
            'Try again after clearing the cache.',
          ]},
          'If that does not work: Contact Toros and tell him the page will not load. Include what browser you are using.',
        ],
      },
      {
        title: '"Not Connected" Error on QBO Connect Page',
        content: [
          { type: 'label', text: 'Problem' },
          'You see a red "Disconnected" status on the QBO Connect page or in System Health under QBO API.',
          { type: 'label', text: 'Cause' },
          'The connection between the platform and QuickBooks Online has expired or was never set up.',
          { type: 'label', text: 'Fix' },
          { type: 'list', ordered: true, items: [
            'Go to Settings in the left sidebar.',
            'Click the QBO Connect section or tab.',
            'Click Connect to QuickBooks.',
            'A QuickBooks login page will open. Sign in with your QuickBooks credentials.',
            'Follow the prompts to authorize the connection.',
            'You will be redirected back to the app. Check System Health to confirm QBO shows green.',
          ]},
          'If that does not work: Contact Toros. The QuickBooks credentials or app configuration may need to be updated.',
        ],
      },
      {
        title: 'Vendor Dropdown Is Empty',
        content: [
          { type: 'label', text: 'Problem' },
          'When creating a PO, the Vendor dropdown shows nothing or says "No vendors found."',
          { type: 'label', text: 'Cause' },
          'The vendor list may not have been loaded yet, or it may be out of date.',
          { type: 'label', text: 'Fix' },
          { type: 'list', ordered: true, items: [
            'Go to Settings in the left sidebar.',
            'Find the Cache or Refresh section.',
            'Click Refresh Vendor List.',
            'Wait a few seconds, then go back to Create PO and try the dropdown again.',
          ]},
          'If the vendor you need is still missing: The vendor does not exist in QuickBooks Online yet. Ask your QuickBooks manager to add the vendor, then refresh the vendor list.',
        ],
      },
      {
        title: 'Item Dropdown Is Empty',
        content: [
          { type: 'label', text: 'Problem' },
          'When adding a line item to a PO, the Item dropdown shows nothing.',
          { type: 'label', text: 'Fix' },
          { type: 'list', ordered: true, items: [
            'Go to Settings in the left sidebar.',
            'Click Refresh Item List.',
            'Wait a few seconds, then go back to Create PO and try adding a line item again.',
          ]},
          'If the item you need is missing: The item does not exist in QuickBooks Online. Ask your QuickBooks manager to add it, then refresh the item list.',
        ],
      },
      {
        title: 'PO Submission Fails with an Error',
        content: [
          { type: 'label', text: 'Problem' },
          'You click Submit and see a red error message instead of a success confirmation.',
          { type: 'label', text: 'Cause' },
          'The most common causes: the QuickBooks connection expired, a required field was left blank, or QuickBooks rejected the data.',
          { type: 'label', text: 'Fix' },
          { type: 'list', ordered: true, items: [
            'Read the error message carefully. It often tells you exactly what went wrong.',
            'If the error mentions a token or connection, go to System Health and check QBO API. If red, try reconnecting.',
            'If the error mentions a missing field, scroll up and make sure Vendor, Date, and at least one line item are filled in.',
            'Try submitting again.',
          ]},
          'If that does not work: Take a screenshot of the error message and contact Toros.',
        ],
      },
      {
        title: 'Google Sheets Import Shows No Data',
        content: [
          { type: 'label', text: 'Problem' },
          'You click "Load from Google Sheets" and the preview table is empty.',
          { type: 'label', text: 'Fix' },
          { type: 'list', ordered: true, items: [
            'Make sure there is data in the Google Sheet and that the rows start in row 2 (row 1 is the header).',
            'Check that the data is in the columns your team agreed on with Toros.',
            'Go to Settings and check the Google Sheets section. Confirm the Sheet ID is entered correctly.',
          ]},
          'If that does not work: Contact Toros. The column mapping or sheet ID may need to be updated.',
        ],
      },
      {
        title: 'Google Sheets "Test Connection" Fails',
        content: [
          { type: 'label', text: 'Problem' },
          'You click "Test Connection" and see a failure or error message.',
          { type: 'label', text: 'Cause' },
          'The platform cannot access the Google Sheet. Usually the Sheet ID is wrong, the sheet is not shared, or has been deleted.',
          { type: 'label', text: 'Fix' },
          { type: 'list', ordered: true, items: [
            'Double-check the Sheet ID in Settings. The Sheet ID is the long string in the Google Sheets URL between /d/ and /edit.',
            'Make sure the Google Sheet is set to "Anyone with the link can view" or is shared with the service account.',
            'Confirm the sheet still exists in Google Drive.',
          ]},
          'If that does not work: Contact Toros with the Sheet ID and the exact error message.',
        ],
      },
      {
        title: 'AI Chat Says "Unavailable" or Does Not Respond',
        content: [
          { type: 'label', text: 'Problem' },
          'You type a message in AI Chat and get a response saying the AI is unavailable, or the chat does not respond.',
          { type: 'label', text: 'Fix' },
          { type: 'list', ordered: true, items: [
            'Go to System Health and check the Ollama and Claude API rows.',
            'If Ollama is red, the local AI is not running. The app may still work with the cloud AI.',
            'Refresh the page and try again.',
          ]},
          'If that does not work: Contact Toros. The AI service needs to be restarted. The rest of the platform still works even when AI Chat is unavailable.',
        ],
      },
      {
        title: 'Settings Won\'t Save',
        content: [
          { type: 'label', text: 'Problem' },
          'You make a change in Settings, click Save, and either see an error or the changes disappear on reload.',
          { type: 'label', text: 'Fix' },
          { type: 'list', ordered: true, items: [
            'Make sure you clicked the Save button after making your changes. Look for a green confirmation message.',
            'Check your internet connection.',
            'Go to System Health and check the Firestore row. If it is red, the database is not accessible.',
            'Try refreshing the page, making the change again, and saving.',
          ]},
          'If that does not work: Contact Toros with a description of what setting you tried to change and what error appeared.',
        ],
      },
      {
        title: 'Page Is Very Slow',
        content: [
          { type: 'label', text: 'Problem' },
          'Pages take more than 10 to 15 seconds to load, or actions take a very long time.',
          { type: 'label', text: 'Fix' },
          { type: 'list', ordered: true, items: [
            'Check your internet speed by opening another website or running a speed test.',
            'Try refreshing the page.',
            'Go to System Health. If any service shows a high latency or yellow status, that service may be slowing things down.',
            'Wait a few minutes and try again.',
          ]},
          'If that does not work: Contact Toros and describe which page or action is slow.',
        ],
      },
      {
        title: '"Token Expired" Error',
        content: [
          { type: 'label', text: 'Problem' },
          'You see an error message about "Token expired" or "Access token has expired," or the QBO API shows "expired" on System Health.',
          { type: 'label', text: 'Cause' },
          'The QuickBooks connection uses a temporary access token that expires after 60 minutes of inactivity. The platform normally refreshes this automatically.',
          { type: 'label', text: 'Fix' },
          { type: 'list', ordered: true, items: [
            'Go to Settings, then the QBO Connect section.',
            'Click Refresh Token.',
            'If Refresh Token succeeds, try your action again.',
            'If Refresh Token fails, click Connect to QuickBooks and log in again.',
          ]},
          'If that does not work: Contact Toros. The refresh token itself may have expired.',
        ],
      },
      {
        title: 'Can\'t Approve a Draft',
        content: [
          { type: 'label', text: 'Problem' },
          'You go to Pending Drafts and click Approve, but nothing happens or you see an error.',
          { type: 'label', text: 'Fix' },
          { type: 'list', ordered: true, items: [
            'Check System Health and confirm QBO API is green.',
            'If QBO shows red, reconnect first, then try approving again.',
            'Open the draft and check that the vendor and all items listed still exist in QuickBooks.',
            'Refresh the page and try again.',
          ]},
          'If that does not work: Take a screenshot of the error message and the draft details, then contact Toros.',
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Content Renderers & Helpers
// ---------------------------------------------------------------------------

function highlightMatch(text, query) {
  if (!query || !text) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark> : part
  );
}

function renderBlock(block, idx, query) {
  if (typeof block === 'string') {
    return <p key={idx} className="text-sm text-gray-700 leading-relaxed">{query ? highlightMatch(block, query) : block}</p>;
  }
  if (block.type === 'list') {
    const Tag = block.ordered ? 'ol' : 'ul';
    return (
      <Tag key={idx} className={`text-sm text-gray-700 leading-relaxed space-y-1 ml-1 ${block.ordered ? 'list-decimal pl-5' : 'list-disc pl-5'}`}>
        {block.items.map((item, i) => <li key={i}>{item}</li>)}
      </Tag>
    );
  }
  if (block.type === 'heading') {
    return <h4 key={idx} className="text-sm font-semibold text-atd-dark mt-3">{block.text}</h4>;
  }
  if (block.type === 'label') {
    return <p key={idx} className="text-xs font-bold uppercase tracking-wide text-gray-500 mt-3 first:mt-0">{block.text}</p>;
  }
  if (block.type === 'faq') {
    return (
      <div key={idx} className="border-l-2 border-atd-blue pl-4 py-1">
        <p className="text-sm font-semibold text-atd-dark">{block.question}</p>
        <p className="text-sm text-gray-700 mt-1">{block.answer}</p>
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helper: flatten all text from a tab for search
// ---------------------------------------------------------------------------

function extractText(block) {
  if (typeof block === 'string') return block;
  if (block.type === 'list') return block.items.join(' ');
  if (block.type === 'heading' || block.type === 'label') return block.text;
  if (block.type === 'faq') return `${block.question} ${block.answer}`;
  return '';
}

function sectionMatchesSearch(section, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  if (section.title.toLowerCase().includes(q)) return true;
  return section.content.some((block) => extractText(block).toLowerCase().includes(q));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Help() {
  const [activeTab, setActiveTab] = useState('quick-start');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollRef = useRef(null);

  // When search is active, show matching results from all tabs
  const isSearching = search.trim().length > 0;

  // Expand all sections in active tab on first visit
  useEffect(() => {
    const tab = TABS.find((t) => t.id === activeTab);
    if (!tab) return;
    setExpanded((prev) => {
      const next = { ...prev };
      let changed = false;
      tab.sections.forEach((s) => {
        const key = `${tab.id}::${s.title}`;
        if (!(key in next)) {
          // First section expanded by default, others collapsed
          next[key] = tab.sections.indexOf(s) === 0;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [activeTab]);

  // Back-to-top visibility
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => setShowBackToTop(el.scrollTop > 400);
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const toggleSection = useCallback((key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const expandAll = useCallback(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      const tabs = isSearching ? TABS : [TABS.find((t) => t.id === activeTab)];
      tabs.forEach((tab) => {
        if (!tab) return;
        tab.sections.forEach((s) => { next[`${tab.id}::${s.title}`] = true; });
      });
      return next;
    });
  }, [activeTab, isSearching]);

  const collapseAll = useCallback(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      const tabs = isSearching ? TABS : [TABS.find((t) => t.id === activeTab)];
      tabs.forEach((tab) => {
        if (!tab) return;
        tab.sections.forEach((s) => { next[`${tab.id}::${s.title}`] = false; });
      });
      return next;
    });
  }, [activeTab, isSearching]);

  // Determine which sections to render
  const visibleTabs = isSearching ? TABS : [TABS.find((t) => t.id === activeTab)];
  const visibleSections = [];
  visibleTabs.forEach((tab) => {
    if (!tab) return;
    tab.sections.forEach((section) => {
      if (sectionMatchesSearch(section, search)) {
        visibleSections.push({ tab, section, key: `${tab.id}::${section.title}` });
      }
    });
  });

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="p-6 max-w-3xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-atd-dark">Help & Documentation</h1>
          <p className="text-gray-500 text-sm mt-1">Guides and troubleshooting for the ATD QBO Platform</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all documentation..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium"
            >
              Clear
            </button>
          )}
        </div>

        {/* Tabs (hidden when searching) */}
        {!isSearching && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-atd-dark shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Search results header */}
        {isSearching && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {visibleSections.length} result{visibleSections.length !== 1 ? 's' : ''} for "{search}"
            </p>
            <div className="flex gap-2">
              <button onClick={expandAll} className="text-xs text-atd-blue hover:text-blue-700 font-medium">Expand All</button>
              <span className="text-gray-300">|</span>
              <button onClick={collapseAll} className="text-xs text-atd-blue hover:text-blue-700 font-medium">Collapse All</button>
            </div>
          </div>
        )}

        {/* Expand/Collapse controls (when not searching) */}
        {!isSearching && (
          <div className="flex justify-end gap-2">
            <button onClick={expandAll} className="text-xs text-atd-blue hover:text-blue-700 font-medium">Expand All</button>
            <span className="text-gray-300">|</span>
            <button onClick={collapseAll} className="text-xs text-atd-blue hover:text-blue-700 font-medium">Collapse All</button>
          </div>
        )}

        {/* Sections */}
        {visibleSections.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No results found for "{search}"</p>
            <p className="text-xs mt-1">Try different keywords</p>
          </div>
        )}

        <div className="space-y-2">
          {visibleSections.map(({ tab, section, key }) => {
            const isOpen = expanded[key] ?? false;
            return (
              <div key={key} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection(key)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  }
                  <span className="text-sm font-semibold text-atd-dark flex-1">{isSearching ? highlightMatch(section.title, search) : section.title}</span>
                  {isSearching && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">{tab.label}</span>
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pl-12 space-y-2">
                    {section.content.map((block, idx) => renderBlock(block, idx, isSearching ? search : null))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Contact footer */}
        <div className="text-center text-xs text-gray-400 pt-4">
          For any issue not listed here, contact Toros Asik.
        </div>
      </div>

      {/* Back to Top */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 bg-atd-dark text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
          aria-label="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
