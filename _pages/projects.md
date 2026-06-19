---
layout: page
title: Projects
permalink: /projects/
description: Research projects by Frank Yifei Zhu on transparent social science pipelines with language models, political fact discovery, experiments, and Chinese elite politics.
nav: true
nav_order: 3
hide_header: true
---

## Scalable and Transparent Dataset Building

See the [Poli Searcher project note]({{ '/blog/2026/poli-searcher/' | relative_url }}) for the full pipeline description, resources, and coming-soon implementation notes.

<div class="publications">
{% bibliography --group_by none --query @*[key=zhu2025agentic] %}
{% bibliography --group_by none --query @*[key=zhu2025politnuggets] %}
</div>

## Language Models for Experiments

<div class="publications">
{% bibliography --group_by none --query @*[key=wei2025silicon] %}
{% bibliography --group_by none --query @*[key=su2025consensus] %}
</div>

## Chinese Elite Politics

I built and validated a comprehensive dataset about the central and provincial party committee members from 1978 to 2025, with detailed coding of their biographical profiles. Using language models to construct and verify the dataset, this project shifts the research focus from government to party.

<div class="publications">
{% bibliography --group_by none --query @*[key=zhu2025power] %}
{% bibliography --group_by none --query @*[key=feng2025party] %}
</div>
