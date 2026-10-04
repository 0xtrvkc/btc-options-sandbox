/* Application adapter; all writes require an explicit action button. */
(function () {
  'use strict';
  function init() {
    JevUI.mount({
      title: 'Find a research view',
      description:
        'Describe what you want to inspect. Preview the suggested panel before opening it; ranges, collateral and settings are unchanged.',
      fields: [
        {
          key: 'query',
          label: 'Research request',
          max: 600,
          placeholder: 'Compare downside touches with expiry breaches',
        },
      ],
      runLabel: 'Find analysis',
      input(v) {
        return { query: v.query };
      },
      actionLabel: 'Open suggested view',
      action(row) {
        window.JevApp.openResearch(row.action);
      },
    });
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
