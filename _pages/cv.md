---
layout: page
permalink: /cv/
title: CV
nav: true
nav_order: 5
description: Academic CV — Political Methodology and AI for Social Science
_styles: |
  .cv-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 0 0 1rem;
  }
  .cv-viewer {
    width: 100%;
    height: 78vh;
    min-height: 720px;
    border: 1px solid var(--global-divider-color);
    border-radius: 0.35rem;
    background: var(--global-card-bg-color);
  }
  .cv-mobile-note {
    margin-top: 0.75rem;
    color: var(--global-text-color-light);
    font-size: 0.95rem;
  }
  @media (max-width: 576px) {
    .cv-viewer {
      min-height: 560px;
      height: 72vh;
    }
  }
---

{% assign methods_cv = '/assets/pdf/Yifei_Zhu_Academic_CV_Methods.pdf' | relative_url %}

<div class="cv-actions">
  <a class="btn btn-primary" href="{{ methods_cv }}" target="_blank" rel="noopener noreferrer">
    <i class="fa-solid fa-file-pdf"></i>&nbsp; Open PDF
  </a>
  <a class="btn btn-outline-primary" href="{{ methods_cv }}" download>
    <i class="fa-solid fa-download"></i>&nbsp; Download CV
  </a>
</div>

<iframe
  class="cv-viewer"
  src="{{ methods_cv }}#view=FitH"
  title="Yifei Zhu academic CV — Political Methodology"
  loading="eager"
></iframe>

<p class="cv-mobile-note">
  If the embedded document does not display on your device, use <a href="{{ methods_cv }}" target="_blank" rel="noopener noreferrer">Open PDF</a>.
</p>
