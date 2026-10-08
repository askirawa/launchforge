(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const escape = v =>
    String(v ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));

  const state = {
    sessions: [],
    model: null,
    busy: false,
    current: null
  };

  const titles = {
    new: [
      'New analysis',
      'Describe the product you want to build.'
    ],
    dashboard: [
      'Dashboard',
      'An overview of this session’s analyses.'
    ],
    history: [
      'History',
      'Revisit your analyses from this session.'
    ],
    settings: [
      'Settings',
      'Set your defaults and build context.'
    ]
  };

  /*
   * LaunchForge AI adapter
   *
   * The browser never receives the OpenAI API key.
   * It sends the idea to our Vercel serverless function:
   *
   * Browser → /api/analyze → OpenAI
   */
  window.LaunchForge = Object.freeze({
    registerModel(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError('A model adapter function is required.');
      }

      state.model = fn;
    }
  });

  window.LaunchForge.registerModel(
    async ({ idea, depth, context, signal }) => {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          idea,
          depth,
          context
        }),
        signal
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error('The AI server returned an invalid response.');
      }

      if (!response.ok) {
        throw new Error(
          data?.error || 'AI analysis failed.'
        );
      }

      return data;
    }
  );

  function setTitle(view) {
    const title = titles[view] || titles.new;

    const heading = $('#viewTitle');
    const description = $('#viewDescription');

    if (heading) heading.textContent = title[0];
    if (description) description.textContent = title[1];
  }

  function showView(view) {
    $$('.view').forEach(el => {
      el.classList.toggle(
        'is-active',
        el.dataset.view === view
      );
    });

    $$('.side-link').forEach(el => {
      el.classList.toggle(
        'is-active',
        el.dataset.view === view
      );
    });

    setTitle(view);
  }

  function openWorkspace(view = 'new') {
    const landing = $('#landing');
    const workspace = $('#workspace');

    if (landing) landing.hidden = true;
    if (workspace) workspace.hidden = false;

    showView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeWorkspace() {
    const landing = $('#landing');
    const workspace = $('#workspace');

    if (workspace) workspace.hidden = true;
    if (landing) landing.hidden = false;

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setDefaultDetail() {
    const saved = localStorage.getItem(
      'launchforge-detail'
    );

    const select = $('#defaultDetail');

    if (select && saved) {
      select.value = saved;
    }

    const detail = $('#detailSelect');

    if (detail && saved) {
      detail.value = saved;
    }
  }

  function saveDefaultDetail() {
    const select = $('#defaultDetail');

    if (!select) return;

    localStorage.setItem(
      'launchforge-detail',
      select.value
    );

    const detail = $('#detailSelect');

    if (detail) {
      detail.value = select.value;
    }
  }

  function buildPrompt(idea, depth, context) {
    return `
You are LaunchForge, an expert product strategist and startup launch copilot.

Turn the following product idea into a practical launch-ready blueprint.

Be specific, realistic, commercially useful, and concise.

Analyze:
- product overview
- core problem
- target users
- value proposition
- differentiation
- MVP features
- product roadmap
- launch readiness
- improvements
- launch positioning
- product description
- 30-second pitch
- tagline
- social launch copy

Depth: ${depth}
Build context: ${context}

Return ONLY valid JSON matching this structure:

{
  "overview": "string",
  "problem": "string",
  "targetUsers": "string",
  "valueProposition": "string",
  "differentiator": "string",
  "mvpFeatures": ["string"],
  "roadmap": [
    {
      "phase": "string",
      "tasks": ["string"]
    },
    {
      "phase": "string",
      "tasks": ["string"]
    },
    {
      "phase": "string",
      "tasks": ["string"]
    }
  ],
  "readinessScore": 0,
  "improvements": ["string", "string", "string"],
  "xPost": "string",
  "productDescription": "string",
  "pitch": "string",
  "tagline": "string"
}

Product idea:
${JSON.stringify(idea)}
`;
  }

  function fallback(idea, context) {
    return {
      overview:
        `A product concept focused on solving a clear user problem: ${idea}`,

      problem:
        'The concept should be validated against a specific and measurable customer pain point.',

      targetUsers:
        'Start with a narrow group of users who experience the problem frequently.',

      valueProposition:
        'Provide a simpler, faster, or more effective way to solve the target problem.',

      differentiator:
        'Build a clear advantage around workflow, distribution, data, trust, or user experience.',

      mvpFeatures: [
        'Core product workflow',
        'User onboarding',
        'Basic analytics or feedback loop',
        'Simple account or workspace'
      ],

      roadmap: [
        {
          phase: 'Phase 1 — Validate',
          tasks: [
            'Define the core user problem',
            'Interview target users',
            'Build the smallest usable prototype'
          ]
        },
        {
          phase: 'Phase 2 — Build',
          tasks: [
            'Implement the core workflow',
            'Measure activation and retention',
            'Improve the product using user feedback'
          ]
        },
        {
          phase: 'Phase 3 — Launch',
          tasks: [
            'Prepare launch messaging',
            'Acquire initial users',
            'Measure and iterate'
          ]
        }
      ],

      readinessScore: null,

      improvements: [
        'Narrow the initial target customer',
        'Define a measurable success metric',
        'Validate willingness to pay before scaling'
      ],

      xPost:
        'Building a product starts with solving a real problem. The next step is turning the idea into a focused MVP and testing it with real users.',

      productDescription:
        'A focused product designed to help users solve a specific problem more effectively.',

      pitch:
        `LaunchForge helps turn this idea into a practical product plan.`,

      tagline:
        'From idea to launch.',

      context
    };
  }

  function decode(response) {
    if (!response) {
      throw new Error('Empty model response.');
    }

    if (response.data) {
      return response;
    }

    if (typeof response === 'string') {
      return {
        data: JSON.parse(response)
      };
    }

    if (response.output_text) {
      return {
        data: JSON.parse(response.output_text)
      };
    }

    if (response.output) {
      return {
        data: response.output
      };
    }

    return response;
  }

  function renderList(items) {
    if (!Array.isArray(items)) return '';

    return items
      .map(item => `<li>${escape(item)}</li>`)
      .join('');
  }

  function renderRoadmap(roadmap) {
    if (!Array.isArray(roadmap)) return '';

    return roadmap
      .map(item => `
        <li>
          <b>${escape(item.phase)}</b>
          <span>
            ${Array.isArray(item.tasks)
              ? item.tasks.map(escape).join(' · ')
              : ''}
          </span>
        </li>
      `)
      .join('');
  }

  function render(session) {
    const results = $('#results');

    if (!results) return;

    const data = session.data || {};

    const status = session.local
      ? `
        <div class="panel" style="margin-bottom:1rem;border-color:#7d5b32">
          <strong>Local planning template</strong>
          <p style="margin-top:.35rem;color:var(--muted)">
            ${escape(session.reason || 'AI analysis unavailable.')}
            This is a local planning template, not an AI analysis.
          </p>
        </div>
      `
      : `
        <div class="panel" style="margin-bottom:1rem">
          <strong>AI-generated analysis</strong>
          <p style="margin-top:.35rem;color:var(--muted)">
            Validate assumptions with real users before making major decisions.
          </p>
        </div>
      `;

    const score =
      typeof data.readinessScore === 'number'
        ? Math.max(
            0,
            Math.min(100, data.readinessScore)
          )
        : null;

    results.innerHTML = `
      ${status}

      <div class="panel">
        <div class="tabs">
          <button class="tab is-active" data-result-tab="blueprint">
            Blueprint
          </button>

          <button class="tab" data-result-tab="roadmap">
            Roadmap
          </button>

          <button class="tab" data-result-tab="launch">
            Launch kit
          </button>
        </div>

        <div class="tab-panel is-active" data-result-panel="blueprint">

          <h2>Overview</h2>
          <p>${escape(data.overview)}</p>

          <div style="margin-top:1.5rem">
            <ul class="lines">

              <li>
                <span>Problem</span>
                <b>${escape(data.problem)}</b>
              </li>

              <li>
                <span>Target users</span>
                <b>${escape(data.targetUsers)}</b>
              </li>

              <li>
                <span>Value proposition</span>
                <b>${escape(data.valueProposition)}</b>
              </li>

              <li>
                <span>Differentiator</span>
                <b>${escape(data.differentiator)}</b>
              </li>

            </ul>
          </div>

          <div style="margin-top:1.5rem">
            <h3 style="margin-bottom:.7rem">
              MVP features
            </h3>

            <ul class="lines">
              ${renderList(data.mvpFeatures)}
            </ul>
          </div>

          ${
            score !== null
              ? `
                <div class="score-row">
                  <span class="score-label">
                    Launch readiness
                  </span>

                  <div class="bar">
                    <i style="width:${score}%"></i>
                  </div>

                  <span class="score-val">
                    ${score}/100
                  </span>
                </div>
              `
              : ''
          }

        </div>

        <div class="tab-panel" data-result-panel="roadmap">

          <h2>Roadmap</h2>

          <ul class="phases">
            ${renderRoadmap(data.roadmap)}
          </ul>

          <div style="margin-top:1.5rem">
            <h3 style="margin-bottom:.7rem">
              Recommended improvements
            </h3>

            <ul class="lines">
              ${renderList(data.improvements)}
            </ul>
          </div>

        </div>

        <div class="tab-panel" data-result-panel="launch">

          <h2>Launch kit</h2>

          <ul class="lines">

            <li>
              <span>Tagline</span>
              <b>${escape(data.tagline)}</b>
            </li>

            <li>
              <span>Product description</span>
              <b>${escape(data.productDescription)}</b>
            </li>

            <li>
              <span>30-second pitch</span>
              <b>${escape(data.pitch)}</b>
            </li>

            <li>
              <span>X post</span>
              <b>${escape(data.xPost)}</b>
            </li>

          </ul>

          <div style="margin-top:1.25rem">
            <button class="btn outline" id="copyLaunch">
              Copy launch kit
            </button>
          </div>

        </div>
      </div>
    `;

    bindResultTabs();

    const copyButton = $('#copyLaunch');

    if (copyButton) {
      copyButton.addEventListener('click', async () => {
        const text = [
          data.tagline,
          data.productDescription,
          data.pitch,
          data.xPost
        ]
          .filter(Boolean)
          .join('\n\n');

        try {
          await navigator.clipboard.writeText(text);

          copyButton.textContent = 'Copied';

          setTimeout(() => {
            copyButton.textContent = 'Copy launch kit';
          }, 1500);

        } catch {
          copyButton.textContent = 'Copy failed';
        }
      });
    }
  }

  function bindResultTabs() {
    $$('[data-result-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.resultTab;

        $$('[data-result-tab]').forEach(item => {
          item.classList.toggle(
            'is-active',
            item === tab
          );
        });

        $$('[data-result-panel]').forEach(panel => {
          panel.classList.toggle(
            'is-active',
            panel.dataset.resultPanel === target
          );
        });
      });
    });
  }

  function renderHistory() {
    const container = $('#historyList');

    if (!container) return;

    if (!state.sessions.length) {
      container.innerHTML = `
        <div class="empty">
          <h2>No analyses yet</h2>
          <p>Your completed analyses will appear here.</p>
        </div>
      `;

      return;
    }

    container.innerHTML = state.sessions
      .map(session => `
        <button
          class="card"
          data-history-id="${escape(session.id)}"
          style="width:100%;text-align:left;cursor:pointer;margin-bottom:.75rem"
        >
          <h3>${escape(session.idea)}</h3>

          <p>
            ${escape(session.date)}
            ·
            ${session.local ? 'Local' : 'AI'}
          </p>
        </button>
      `)
      .join('');

    $$('[data-history-id]').forEach(button => {
      button.addEventListener('click', () => {
        const session = state.sessions.find(
          item => item.id === button.dataset.historyId
        );

        if (!session) return;

        state.current = session;

        openWorkspace('new');

        render(session);
      });
    });
  }

  function renderDashboard() {
    const count = $('#dashboardCount');

    if (count) {
      count.textContent = String(
        state.sessions.length
      );
    }
  }

  async function run() {
    if (state.busy) return;

    const input = $('#ideaInput');
    const button = $('#runBtn');

    if (!input || !button) return;

    const idea = input.value.trim();

    if (!idea) {
      input.focus();
      return;
    }

    const depth =
      $('#detailSelect')?.value || 'standard';

    const context =
      $('#buildContext')?.value || 'sprint';

    state.busy = true;

    button.disabled = true;
    button.textContent = 'Generating…';

    $('#results')?.setAttribute(
      'aria-busy',
      'true'
    );

    let result;
    let local = false;
    let reason = '';

    try {
      if (!state.model) {
        throw new Error(
          'Model adapter is not connected.'
        );
      }

      const controller = new AbortController();

      let timer;

      try {
        const response = await Promise.race([
          Promise.resolve().then(() =>
            state.model({
              idea,
              prompt: buildPrompt(
                idea,
                depth,
                context
              ),
              depth,
              context,
              signal: controller.signal
            })
          ),

          new Promise((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();

              reject(
                new Error(
                  'Model request timed out.'
                )
              );
            }, 45000);
          })
        ]);

        result = decode(response);

      } finally {
        clearTimeout(timer);
      }

    } catch (error) {
      console.error(error);

      local = true;

      reason =
        error?.message ||
        'The AI request could not be completed.';

      result = {
        data: fallback(
          idea,
          context
        )
      };

    } finally {
      state.busy = false;

      button.disabled = false;
      button.textContent =
        'Generate blueprint';

      $('#results')?.removeAttribute(
        'aria-busy'
      );
    }

    const session = {
      ...result,

      local,
      reason,
      idea,

      id:
        String(Date.now()) +
        Math.random()
          .toString(36)
          .slice(2, 6),

      date:
        new Date().toLocaleString()
    };

    state.sessions.unshift(session);

    const historyCount =
      $('#historyCount');

    if (historyCount) {
      historyCount.textContent =
        String(state.sessions.length);
    }

    state.current = session;

    render(session);
    renderHistory();
    renderDashboard();
  }

  function bindNavigation() {
    $$('.side-link').forEach(link => {
      link.addEventListener('click', () => {
        const view =
          link.dataset.view || 'new';

        openWorkspace(view);
      });
    });

    $$('[data-open-workspace]').forEach(button => {
      button.addEventListener('click', () => {
        openWorkspace('new');
      });
    });

    $$('[data-close-workspace]').forEach(button => {
      button.addEventListener('click', closeWorkspace);
    });
  }

  function bindExamples() {
    $$('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const input = $('#ideaInput');

        if (!input) return;

        input.value =
          chip.dataset.idea ||
          chip.textContent.trim();

        input.focus();
      });
    });
  }

  function bindControls() {
    const runButton = $('#runBtn');

    if (runButton) {
      runButton.addEventListener(
        'click',
        run
      );
    }

    const input = $('#ideaInput');

    if (input) {
      input.addEventListener('keydown', event => {
        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key === 'Enter'
        ) {
          event.preventDefault();
          run();
        }
      });
    }

    const clearButton = $('#clearBtn');

    if (clearButton) {
      clearButton.addEventListener(
        'click',
        () => {
          state.sessions = [];
          state.current = null;

          if (input) {
            input.value = '';
          }

          renderHistory();
          renderDashboard();

          const results = $('#results');

          if (results) {
            results.innerHTML = `
              <div class="empty">
                <h2>Ready when you are</h2>
                <p>
                  Describe a product idea and generate
                  your launch-ready blueprint.
                </p>
              </div>
            `;
          }

          const historyCount =
            $('#historyCount');

          if (historyCount) {
            historyCount.textContent = '0';
          }
        }
      );
    }

    const defaultDetail =
      $('#defaultDetail');

    if (defaultDetail) {
      defaultDetail.addEventListener(
        'change',
        saveDefaultDetail
      );
    }
  }

  function init() {
    bindNavigation();
    bindExamples();
    bindControls();
    setDefaultDetail();
    renderHistory();
    renderDashboard();

    const workspace =
      $('#workspace');

    if (workspace) {
      workspace.hidden = true;
    }
  }

  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      init
    );
  } else {
    init();
  }
})();
