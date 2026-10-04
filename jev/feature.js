/* Bounded decisions for this application. */
(function (root, factory) {
  const api = factory(
    root.JevContract || (typeof require === 'function' ? require('./contract.js') : null),
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.JevFeature = api;
})(globalThis, function (C) {
  'use strict';

  const routes = {
    touch: {
      code: '05',
      title: 'Path and touch risk',
      description:
        'Compare touches, expiry containment and lower/upper breaches without changing strikes.',
    },
    stability: {
      code: '08',
      title: 'Rolling stability',
      description: 'Inspect historical variation across moving samples.',
    },
    cases: {
      code: '20',
      title: 'Historical cases',
      description: 'Review individual sessions, paths, outcomes and model deltas.',
    },
    range: {
      code: null,
      title: 'Strike range explorer',
      description:
        'Inspect candidate fixed ranges. Use existing Apply controls to change the research range.',
    },
    pricing: {
      code: '02',
      title: 'Entry desk',
      description: 'Review quote-based comparisons, collateral and pricing assumptions.',
    },
    index: {
      code: null,
      title: 'Index and guide',
      description: 'Open definitions and explanations.',
    },
  };
  const F = {
    id: 'research-router',
    private: false,
    routes,
    build(input) {
      return {
        state: { query: C.text(input.query, 'Research request', 600) },
        questions: {
          route: C.choice(
            'Which existing research view best addresses `query`? This action only navigates. Do not select strikes, change collateral, imply profitability or execute a trade.',
            {
              touch: 'Touches versus expiry breaches and downside or upside path risk',
              stability: 'Rolling or time-varying containment',
              cases: 'Specific past sessions and historical delta',
              range: 'Compare fixed strike ranges',
              pricing: 'Entry quotes, pricing, premium, collateral and costs',
              index: 'Definitions, help and navigation',
              none: 'Unsupported request, trading execution or no matching analysis',
            },
          ),
        },
      };
    },
    present(input, answers) {
      const k = C.decision(answers.route),
        r = routes[k];
      return [
        {
          title: r?.title || 'No navigation selected',
          label:
            k === 'review'
              ? 'Needs review'
              : k === 'none'
                ? 'No matching action'
                : 'Suggested view',
          detail: r?.description || 'Try asking for an existing research panel.',
          confidence: answers.route.confidence,
          action: r ? k : null,
        },
      ];
    },
  };

  return Object.freeze(F);
});
