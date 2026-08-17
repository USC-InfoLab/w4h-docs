---
title: Welcome to W4H
description: Welcome to the W4H Toolkit
updated_by: nocera@usc.edu
updated_at: 2026-06-19T20:53:36.000Z
---

<p class="fs-4">If you are not familiar with the toolkit, keep reading below. To ingest and analyze wearable data right away, open the
  <a href="{{APP_URL}}/docs/quick-start">⚡️ Quick Start</a> guide.
</p>

<p>Start with the <strong>next-step cards</strong> for your role, then use <strong>Guides</strong> in the sidebar for detail. Open <strong>PHI-safe AI chat</strong> (<kbd>⌘J</kbd> / <kbd>Ctrl+J</kbd>) for import, processing, and IRB questions.</p>

<h2>Welcome — next steps</h2>

<p>Super admin bootstraps platform access. Admins (PIs) set up the trial in the app shell. Users work in assigned projects.</p>

<div class="container-fluid px-0 mt-2 mb-4">
  <div class="row g-3">
    <div class="col-md-4">
      <div class="card h-100 shadow-sm">
        <div class="card-body">
          <div class="fw-bold fs-5 mb-2">Super admin</div>
          <p class="small text-muted">Platform Admin only — SMTP, first team, invite the PI. Not trial setup.</p>
          <ol class="small mb-3">
            <li>Settings → Mail Server</li>
            <li>Teams → Add Team</li>
            <li>Users → Invite as Team admin</li>
            <li>Settings → Refresh Docs</li>
          </ol>
          <a class="btn btn-sm btn-primary" href="{{APP_URL}}/docs/welcome-super-admin">Open Super admin checklist</a>
        </div>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card h-100 shadow-sm">
        <div class="card-body">
          <div class="fw-bold fs-5 mb-2">Admin</div>
          <p class="small text-muted">App shell — projects, link datasets, adapt ingest notebooks, invite members. Super admin does not do this for you.</p>
          <ol class="small mb-3">
            <li>Projects → Add Project</li>
            <li>Link datasets, then adapt an ingest notebook from Contributions</li>
            <li>Invite Admins (ingest) and Users (analytics)</li>
            <li>Chat icon in the nav, if chat is configured</li>
          </ol>
          <a class="btn btn-sm btn-primary" href="{{APP_URL}}/docs/welcome-admin">Open Admin guide</a>
        </div>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card h-100 shadow-sm">
        <div class="card-body">
          <div class="fw-bold fs-5 mb-2">User</div>
          <p class="small text-muted">Assigned projects only. Analyze loaded datasets. You cannot add datasets or edit raw tables.</p>
          <ol class="small mb-3">
            <li>Open your project</li>
            <li>Confirm tables on the dataset overview (loaded)</li>
            <li>Run analytics from Contributions</li>
            <li>Chat icon in the nav, if chat is configured</li>
          </ol>
          <a class="btn btn-sm btn-primary" href="{{APP_URL}}/docs/welcome-user">Open User guide</a>
        </div>
      </div>
    </div>
  </div>
</div>


<h2>Key Concepts</h2>

<p>The W4H Toolkit is a research platform for wearable health data. At a glance it provides:</p>

<ul>
  <li><strong>Projects</strong> — scoped workspaces for a study or analysis effort (<a href="{{APP_URL}}/projects">Projects hub</a>)</li>
  <li><strong>Datasets</strong> — registered collections of wearable signal tables, linked to projects</li>
  <li><strong>Contributions</strong> — curated notebooks, CLI, scripts, and Postgres extensions (<a href="{{APP_URL}}/contributions">catalog</a>)</li>
  <li><strong>Docs</strong> — this documentation browser, organized by topic below</li>
</ul>

<h2>Guides vs. Tutorials</h2>

<p>Documentation in W4H is split into two doc types. They appear as separate sections in the sidebar.</p>

<table class="table table-sm">
  <thead>
    <tr>
      <th></th>
      <th><strong>Guides</strong></th>
      <th><strong>Tutorials</strong></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Purpose</strong></td>
      <td>Explain <em>what</em> the platform does and <em>how</em> to configure it</td>
      <td>Walk you through a task <em>step by step</em>, hands-on</td>
    </tr>
    <tr>
      <td><strong>Style</strong></td>
      <td>Reference-style — read in any order, come back when needed</td>
      <td>Task-oriented — follow along from start to finish</td>
    </tr>
    <tr>
      <td><strong>Best for</strong></td>
      <td>Admins setting up the platform, compliance officers, architects</td>
      <td>Researchers running their first analysis or learning a new workflow</td>
    </tr>
    <tr>
      <td><strong>Examples</strong></td>
      <td>Welcome — Super admin / Welcome — Admin / Welcome — User, Quick Start, HIPAA Compliance, SMTP Configuration</td>
      <td>Import a dataset, issue a project token, run a contribution notebook</td>
    </tr>
  </tbody>
</table>

<p>Not sure where to begin? Use the <strong>Welcome</strong> cards above, or the <a href="{{APP_URL}}/docs/quick-start">Quick Start</a> for a longer tour.</p>

<h2>Pick Your Learning Path</h2>

<p>Everyone learns differently. Choose the path that suits you best, although we do recommend going over all of the content, if possible!</p>

<div class="container mt-2 mb-5">
  <div class="row g-3">
    <div class="col-md-6">
      <div class="alert alert-success rounded shadow-sm p-3 h-100">
        <div class="fw-bold fs-5 mb-2">📖 Read the guides</div>
        <p class="mb-2">Guides walk you through every aspect of the platform in full detail. Good starting points:</p>
        <ul class="mb-0">
          <li><a href="{{APP_URL}}/docs/welcome-super-admin">Welcome — Super admin</a> — platform bootstrap checklist</li>
          <li><a href="{{APP_URL}}/docs/welcome-admin">Welcome — Admin</a> — trial next steps</li>
          <li><a href="{{APP_URL}}/docs/welcome-user">Welcome — User</a> — what Users can and cannot do</li>
          <li><a href="{{APP_URL}}/docs/quick-start">Quick Start</a> — longer tour of core workflows</li>
          <li><a href="{{APP_URL}}/docs/setting-up-projects">Setting Up Projects</a> — multi-dataset projects and shares</li>
          <li><a href="{{APP_URL}}/docs/hipaa-compliance">HIPAA Compliance</a> — audit logging and data handling</li>
        </ul>
      </div>
    </div>
    <div class="col-md-6">
      <div class="alert alert-success rounded shadow-sm p-3 h-100">
        <div class="fw-bold fs-5 mb-2">🧪 Try the tutorials</div>
        <p class="mb-2">Tutorials are short, hands-on walkthroughs. Follow along in your own W4H instance:</p>
        <ul class="mb-0">
          <li>Create a project and invite a researcher</li>
          <li>Link a dataset and preview signal tables</li>
          <li>Issue a project token and connect from a notebook</li>
        </ul>
        <p class="mb-0 mt-2 small text-muted">Tutorial pages will appear in the <strong>Tutorials</strong> section of the sidebar as they are published.</p>
      </div>
    </div>
  </div>
</div>

<h2>Still Got Questions?</h2>

<p>Check out our <a href="{{APP_URL}}/docs/faq">FAQ</a> for answers to common questions, or browse <a href="{{APP_URL}}/docs/whats-new">What's New</a> for recent platform changes.</p>
